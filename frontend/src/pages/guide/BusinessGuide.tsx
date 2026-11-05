import { GuideLayout } from "../../components/guide/GuideLayout";
import { businessGuide } from "../../data/guideContent";

export default function BusinessGuide() {
  return <GuideLayout guide={businessGuide} basePath="/guide/business" />;
}
