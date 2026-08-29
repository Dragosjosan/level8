from collections.abc import Iterator


def composable_doses(total_iu: int, package_sizes: tuple[int, ...]) -> tuple[int, ...]:
    """Return every positive dose up to total_iu obtainable from whole packages."""
    reachable = [False] * (total_iu + 1)
    reachable[0] = True

    for amount in range(total_iu + 1):
        if not reachable[amount]:
            continue
        for package_size in package_sizes:
            next_amount = amount + package_size
            if next_amount <= total_iu:
                reachable[next_amount] = True

    return tuple(
        amount
        for amount, is_reachable in enumerate(reachable)
        if amount > 0 and is_reachable
    )


def exact_schedules(
    total_iu: int,
    doses: tuple[int, ...],
    slot_count: int,
) -> Iterator[tuple[int, ...]]:
    """Yield slot assignments that use exactly total_iu."""
    options = (0, *doses)
    option_set = set(options)

    def build(prefix: tuple[int, ...], remaining_iu: int) -> Iterator[tuple[int, ...]]:
        remaining_slots = slot_count - len(prefix)
        if remaining_slots == 1:
            if remaining_iu in option_set:
                yield (*prefix, remaining_iu)
            return

        for dose in options:
            if dose > remaining_iu:
                break
            yield from build((*prefix, dose), remaining_iu - dose)

    yield from build((), total_iu)


def count_exact_schedules(
    total_iu: int,
    doses: tuple[int, ...],
    slot_count: int,
    *,
    stop_after: int,
) -> int:
    count = 0
    for _ in exact_schedules(total_iu, doses, slot_count):
        count += 1
        if count > stop_after:
            break
    return count
