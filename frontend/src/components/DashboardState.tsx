import { Button } from './Button'

interface ErrorStateProps {
  message: string
  onRetry: () => void
}

export function LoadingState() {
  return (
    <main className="center-state" aria-busy="true">
      <div className="loading-mark" aria-hidden="true" />
      <p>Loading database defaults…</p>
    </main>
  )
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <main className="center-state">
      <p className="eyebrow">Factor VIII Monitor</p>
      <h1>We couldn’t load the dashboard.</h1>
      <p>{message}</p>
      <Button variant="primary" onClick={onRetry}>
        Try again
      </Button>
    </main>
  )
}
