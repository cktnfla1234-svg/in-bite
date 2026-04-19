import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { WelcomeModal } from "./WelcomeModal";
import { CookieLogo } from "./ui/CookieLogo";
import { experiences } from "@/data/experiences";
import {
  computePopularDestinations,
  computePopularTastes,
  fetchInviteDiscoveryRows,
  subscribeInvitesDiscoveryRealtime,
} from "@/lib/homeInviteDiscovery";
import { getLocalInvites, subscribeLocalInvitesSync } from "@/lib/localInvites";

type HomeScreenProps = {
  onOpenAuth?: () => void;
  isSignedIn?: boolean;
  onSearch?: (query: string, taste?: string | null) => void;
};

const DEFAULT_POPULAR_CITIES = [
  "Seoul",
  "Melbourne",
  "Tokyo",
  "Paris",
  "Barcelona",
  "New York",
  "Bangkok",
  "Singapore",
];
const DEFAULT_CURRENT_TASTES = [
  "Cafe Hopping",
  "Night Markets",
  "Art & Culture",
  "Street Food",
  "Hiking",
  "Rooftops",
  "Food Tours",
  "Live Music",
];
const GREETING_META = [
  { lang: "English" },
  { lang: "Korean" },
  { lang: "Japanese" },
  { lang: "Spanish" },
  { lang: "French" },
  { lang: "Chinese" },
] as const;
const WELCOME_DISMISSED_KEY = "inbite:welcome-dismissed:v2";
function getGreetingFontFamily(lang: string) {
  if (lang === "Korean") return "'Gowun Dodum', 'Hi Melody', 'Noto Sans KR', sans-serif";
  if (lang === "Japanese") return "'Hachi Maru Pop', 'Yomogi', 'Noto Sans JP', sans-serif";
  if (lang === "Chinese") return "'ZCOOL KuaiLe', 'Noto Sans SC', sans-serif";
  return "'Patrick Hand', cursive";
}

function getGreetingFontSize(lang: string) {
  if (lang === "Chinese") return "clamp(2.25rem, 8.8vw, 3.55rem)";
  if (lang === "Korean") return "clamp(2.1rem, 8.1vw, 3.4rem)";
  if (lang === "Japanese") return "clamp(2.05rem, 8vw, 3.35rem)";
  return "clamp(1.9rem, 7.4vw, 3.15rem)";
}

export function HomeScreen({
  onOpenAuth,
  isSignedIn = false,
  onSearch,
}: HomeScreenProps) {
  const { t, i18n } = useTranslation("common");
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaste, setSelectedTaste] = useState<string | null>(null);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [showSearchConfirm, setShowSearchConfirm] = useState(false);
  const [popularCities, setPopularCities] = useState<string[]>(() =>
    computePopularDestinations([], [], experiences, DEFAULT_POPULAR_CITIES, 8),
  );
  const [currentTastes, setCurrentTastes] = useState<string[]>(() =>
    computePopularTastes([], [], experiences, DEFAULT_CURRENT_TASTES, 8),
  );
  const discoveryChannelId = useId().replace(/:/g, "");
  const [remoteInviteRows, setRemoteInviteRows] = useState<Awaited<ReturnType<typeof fetchInviteDiscoveryRows>>>([]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setGreetingIndex((prev) => (prev + 1) % GREETING_META.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(WELCOME_DISMISSED_KEY) === "true";
    setWelcomeOpen(!dismissed && !isSignedIn);
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn) {
      setWelcomeOpen(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    let cancelled = false;
    const loadRemote = async () => {
      const rows = await fetchInviteDiscoveryRows();
      if (!cancelled) setRemoteInviteRows(rows);
    };
    void loadRemote();
    const unsubRt = subscribeInvitesDiscoveryRealtime(
      () => {
        void loadRemote();
      },
      { channelSuffix: discoveryChannelId },
    );
    return () => {
      cancelled = true;
      unsubRt();
    };
  }, [discoveryChannelId]);

  useEffect(() => {
    const syncChips = () => {
      const local = getLocalInvites();
      setPopularCities(
        computePopularDestinations(local, remoteInviteRows, experiences, DEFAULT_POPULAR_CITIES, 8),
      );
      setCurrentTastes(
        computePopularTastes(local, remoteInviteRows, experiences, DEFAULT_CURRENT_TASTES, 8),
      );
    };

    syncChips();
    return subscribeLocalInvitesSync(syncChips);
  }, [remoteInviteRows]);

  const handleSearchSubmit = () => {
    const query = searchQuery.trim();
    if (!query) return;
    setShowSearchConfirm(false);
    onSearch?.(query, selectedTaste);
  };

  return (
    <main className="relative min-h-full w-full bg-[#FDFAF5] pb-24">
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 pb-8 pt-10"
      >
        <div className="mb-2 flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-3">
            <CookieLogo size={36} />
            <h1 className="font-brand-display text-[32px]" style={{ color: "#A0522D" }}>
              人-Bite
            </h1>
          </div>
        </div>
        <p
          className="text-center text-sm"
          style={{ color: "#7C6A5E", letterSpacing: "0.01em" }}
        >
          {t("home.tagline")}
        </p>
      </motion.div>

      <WelcomeModal
        open={welcomeOpen}
        onClose={() => {
          setWelcomeOpen(false);
        }}
        onAuthenticated={() => {
          setWelcomeOpen(false);
        }}
        onSecondary={() => {
          setWelcomeOpen(false);
        }}
      />

      <div className="-mt-6 flex min-h-[44vh] flex-col items-center justify-start px-6">
        <div className="mb-7 flex h-28 flex-col items-center justify-center overflow-hidden">
          <AnimatePresence initial={false}>
            <motion.div
              key={greetingIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="text-center"
            >
              <h2
                className="whitespace-nowrap text-center"
                style={{
                  color: "#A0522D",
                  fontFamily: i18n.language.startsWith("ko")
                    ? "'Gowun Dodum', 'Hi Melody', 'Noto Sans KR', sans-serif"
                    : getGreetingFontFamily(GREETING_META[greetingIndex].lang),
                  fontWeight: GREETING_META[greetingIndex].lang === "Korean" ? "700" : "400",
                  fontSize: getGreetingFontSize(GREETING_META[greetingIndex].lang),
                  letterSpacing: "-0.01em",
                }}
              >
                {i18n.language.startsWith("ko") && greetingIndex === 0 ? (
                  <span className="font-bold">{t("home.greeting0")}</span>
                ) : (
                  t(`home.greeting${greetingIndex}` as const)
                )}
              </h2>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative w-full max-w-md">
          <div
            className="flex items-center overflow-hidden bg-white shadow-lg transition-all duration-300"
            style={{ borderRadius: "1.5rem", border: "1.5px solid #EDE0D4" }}
          >
            <Search className="ml-5 h-5 w-5" style={{ color: "#A0522D" }} />
            <input
              type="text"
              placeholder={t("home.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => {
                const next = e.target.value;
                setSearchQuery(next);
                setShowSearchConfirm(Boolean(next.trim()));
              }}
              className="font-body-ko flex-1 bg-transparent py-4 pl-4 pr-2 text-[15px] outline-none"
            />
            {showSearchConfirm ? (
              <motion.button
                initial={false}
                animate={{ opacity: 1, x: 0 }}
                onClick={handleSearchSubmit}
                className="mr-2 rounded-full p-2 transition-colors hover:bg-[#FDFAF5]"
                aria-label={t("common.submitSearch")}
                title={t("common.submitSearch")}
                type="button"
              >
                <div className="rounded-full bg-[#A0522D] p-2.5 text-white">
                  <ArrowRight size={18} />
                </div>
              </motion.button>
            ) : null}
          </div>
        </div>

        <div className="mt-10 w-full max-w-md">
          <p
            className="font-brand-display mb-4 text-center text-[11px] uppercase tracking-[0.2em]"
            style={{ color: "#B89A80" }}
          >
            {t("home.popularDestinations")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {popularCities.map((city) => (
              <button
                key={city}
                onClick={() => {
                  setSearchQuery(city);
                  setShowSearchConfirm(true);
                }}
                className="font-body-ko rounded-full border border-[#EDD5C0] bg-white px-4 py-2 text-sm text-[#3D2F2A] shadow-sm transition-colors hover:bg-[#FFF0E8]"
                type="button"
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 w-full max-w-md">
          <p
            className="font-brand-display mb-4 text-center text-[11px] uppercase tracking-[0.2em]"
            style={{ color: "#B89A80" }}
          >
            {t("home.currentTastes")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {currentTastes.map((taste) => {
              const active = selectedTaste === taste;
              return (
                <button
                  key={taste}
                  type="button"
                  onClick={() =>
                    setSelectedTaste((prev) => (prev === taste ? null : taste))
                  }
                  className="font-body-ko rounded-full px-4 py-2 text-sm text-white shadow-sm transition-colors"
                  style={{
                    backgroundColor: active ? "#8F4929" : "#A0522D",
                  }}
                >
                  {taste}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
