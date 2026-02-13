import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { KickstarterHero } from "@/components/marketing/kickstarter/KickstarterHero";
import { CampaignStory } from "@/components/marketing/kickstarter/CampaignStory";
import { BackerTiers } from "@/components/marketing/kickstarter/BackerTiers";
import { WhyKickstarter } from "@/components/marketing/kickstarter/WhyKickstarter";
import { RisksSection } from "@/components/marketing/kickstarter/RisksSection";
import { KickstarterFAQ } from "@/components/marketing/kickstarter/KickstarterFAQ";
import { FinalCTA } from "@/components/marketing/kickstarter/FinalCTA";

export default function Kickstarter() {
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
