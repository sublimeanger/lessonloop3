import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { KickstarterHero } from "@/components/marketing/kickstarter/KickstarterHero";
import { CampaignStory } from "@/components/marketing/kickstarter/CampaignStory";
import { BackerTiers } from "@/components/marketing/kickstarter/BackerTiers";
import { WhyKickstarter } from "@/components/marketing/kickstarter/WhyKickstarter";
import { RisksSection } from "@/components/marketing/kickstarter/RisksSection";
import { KickstarterFAQ } from "@/components/marketing/kickstarter/KickstarterFAQ";
import { FinalCTA } from "@/components/marketing/kickstarter/FinalCTA";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Kickstarter() {
  usePageMeta('Kickstarter | LessonLoop', 'Back LessonLoop on Kickstarter and get early access');
  return (
    <MarketingLayout>
      <KickstarterHero />
      <CampaignStory />
      <WhyKickstarter />
      <BackerTiers />
      <RisksSection />
      <KickstarterFAQ />
      <FinalCTA />
    </MarketingLayout>
  );
}
