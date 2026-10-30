import { RequestConsole } from '@/components/request-console'

export default function Page() {
  return <RequestConsole nodeVersion={process.version} />
}
