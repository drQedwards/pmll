import { createFileRoute } from "@tanstack/react-router";
import { PlayTest } from "@/components/play-test";

export const Route = createFileRoute("/play")({ component: PlayPage });

function PlayPage() {
  return <PlayTest />;
}
