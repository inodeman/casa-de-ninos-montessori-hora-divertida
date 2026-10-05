import { createFileRoute } from "@tanstack/react-router";
import { Player } from "@/show/Player";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Player />;
}
