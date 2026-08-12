import { AssistClient } from './assist-client'

export default async function AssistPage({
  searchParams,
}: {
  searchParams: Promise<{ text?: string }>
}) {
  const { text } = await searchParams
  return <AssistClient initialText={(text ?? '').trim()} />
}
