/**
 * app/page.app.tsx — the PACKED PHONE APP's only page: the game.
 *
 * The same game the website shows at /road-to-the-golden-ball (app/star-dev),
 * inside the same frame (its layout), started by AppBoot so it reads from
 * the files packed inside the app. Read only by the app build; the website
 * ignores `*.app.tsx` files. See mobile/README.md.
 */
import AppBoot from "@/components/app/AppBoot";
import StarDevLayout from "./star-dev/layout";
import StarCareerGame from "./star-dev/page";

export default function AppHome() {
  return (
    <AppBoot>
      <StarDevLayout>
        <StarCareerGame />
      </StarDevLayout>
    </AppBoot>
  );
}
