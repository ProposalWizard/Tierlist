import ClientErrorBoundary from "@/components/ClientErrorBoundary";
import SquadBuilder from "@/components/SquadBuilder";
import PageGuide from "@/components/admin/PageGuide";

export const metadata = {
  title: "Squad Builder | Knowitball",
  description: "Build your dream squad with any formation. Drag players into position and share your lineup.",
};

export default function SquadBuilderPage() {
  return (
    <ClientErrorBoundary>
      <SquadBuilder />
      <PageGuide page="/squad-builder" />
    </ClientErrorBoundary>
  );
}
