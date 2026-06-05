import ClientErrorBoundary from "@/components/ClientErrorBoundary";
import SquadBuilder from "@/components/SquadBuilder";

export const metadata = {
  title: "Squad Builder | Knowitball",
  description: "Build your dream squad with any formation. Drag players into position and share your lineup.",
};

export default function SquadBuilderPage() {
  return (
    <ClientErrorBoundary>
      <SquadBuilder />
    </ClientErrorBoundary>
  );
}
