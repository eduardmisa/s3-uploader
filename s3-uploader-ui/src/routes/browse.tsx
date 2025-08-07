import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/browse')({
  component: Browse,
})

function Browse() {
  return <div className="p-2">Hello from Browse!</div>
}