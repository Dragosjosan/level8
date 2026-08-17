import {
    requireUtcDateTime,
    toUtcDateTime,
} from '../lib/dateTime'
import type {
    ParetoCandidateResponseDto,
    ParetoRequestDto,
    ParetoResultResponseDto,
} from '../dto/pareto'
import type {
    ParetoCandidate,
    ParetoRequest,
    ParetoResult,
} from '../types'
import { requestJson } from './client'

function parseCandidate(
    candidate: ParetoCandidateResponseDto,
    field: string,
): ParetoCandidate {
    return {
        ...candidate,
        refills: candidate.refills.map(
            (refill, index) => ({
                ...refill,
                startsAt: requireUtcDateTime(
                    refill.startsAt,
                    `${field}.refills[${index}].startsAt`,
                ),
            }),
        ),
    }
}

export async function computePareto(
    input: ParetoRequest,
): Promise<ParetoResult> {
    const body: ParetoRequestDto = {
        ...input,
        firstInfusionAt: toUtcDateTime(
            input.firstInfusionAt,
        ),
    }

    const result =
        await requestJson<ParetoResultResponseDto>(
            '/api/compute/pareto',
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        )

    return {
        ...result,
        candidates: result.candidates.map(
            (candidate, index) =>
                parseCandidate(
                    candidate,
                    `candidates[${index}]`,
                ),
        ),
        front: result.front.map(
            (candidate, index) =>
                parseCandidate(
                    candidate,
                    `front[${index}]`,
                ),
        ),
    }
}
