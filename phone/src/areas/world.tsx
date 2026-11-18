// WORLD AREA: the League's every-league viewer, cups and Europe, the cup draw,
// the phone (feed, messages, apps), the shop, sponsors, the Star Pass and the
// summer transfer window. Open any of them with useNav().go(name, params).
//
//   phone                       the phone's home screen of apps
//   feed        { moment?, onContinue? }  the social feed (moment: post-match reactions)
//   shop        { cat? }        the shop ("cans" | "boots" | "drip" | "gadgets" | "cars" | "homes" | "holiday")
//   sponsors                    deals, offers and brands
//   star-pass                   your star level and its rewards
//   transfers                   the summer window (League → Club → Negotiate)
//   cup-draw    { competition, round, onContinue? }  the draw reveal (world/cupDraw.ts drawToShow)
//   season-review { onClose? }  last season: every trophy (career.lastWorld)
//   store                       the Store (Coins): specials, run-ups, style, boosts, boots, Coins
//   investments                 buying and selling a stake in a club
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ScreenMap } from "./types";
import { useCareer } from "../game/store";
import { useNav } from "../nav";
import { C } from "../ui/theme";
import { PhoneScreen } from "../screens/world/Phone";
import { MediaFeed } from "../screens/world/Feed";
import { ShopScreen } from "../screens/world/Shop";
import { SponsorsScreen } from "../screens/world/Sponsors";
import { StarPassScreen } from "../screens/world/StarPass";
import { TransferHubScreen } from "../screens/world/TransferHub";
import { CupDrawScreen } from "../screens/world/CupDrawReveal";
import { WorldPane } from "../screens/world/WorldPane";
import { StoreScreen } from "../screens/world/Store";
import { InvestmentsScreen } from "../screens/world/Investments";

function FeedScreen({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  const nav = useNav();
  if (!career) return null;
  const moment = !!params?.moment;
  const onContinue = params?.onContinue as (() => void) | undefined;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#05080f" }}>
      <MediaFeed career={career} mode={moment ? "moment" : "browse"} onContinue={moment ? (onContinue ?? (() => nav.back())) : undefined} />
    </SafeAreaView>
  );
}

function SeasonReviewScreen({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  const nav = useNav();
  if (!career) return null;
  const onClose = (params?.onClose as (() => void) | undefined) ?? (() => nav.back());
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ height: 8 }} />
      <WorldPane career={career} last onClose={onClose} />
    </SafeAreaView>
  );
}

export const worldScreens: ScreenMap = {
  phone: PhoneScreen,
  feed: FeedScreen,
  shop: ShopScreen,
  sponsors: SponsorsScreen,
  "star-pass": StarPassScreen,
  transfers: TransferHubScreen,
  "cup-draw": CupDrawScreen,
  "season-review": SeasonReviewScreen,
  store: StoreScreen,
  investments: InvestmentsScreen,
};
