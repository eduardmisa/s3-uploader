import { Button } from '@/components/ui/button'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/browse')({
  component: Browse,
})

function Browse() {
  return <div className="p-2">
    <Button>HELLOW</Button>
  </div>
}