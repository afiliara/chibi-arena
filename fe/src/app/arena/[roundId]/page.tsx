import { ArenaView } from "../page";

export default async function ArenaRoundPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  return <ArenaView forcedRoundId={roundId} />;
}
