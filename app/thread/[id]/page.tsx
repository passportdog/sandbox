import { SandboxApp } from "@/components/SandboxApp";

export default function ThreadPage({ params }: { params: { id: string } }) {
  return <SandboxApp activeThreadId={params.id} />;
}
