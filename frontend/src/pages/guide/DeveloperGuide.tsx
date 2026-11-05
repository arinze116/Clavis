import { GuideLayout } from "../../components/guide/GuideLayout";
import { developerGuide } from "../../data/guideContent";

export default function DeveloperGuide() {
  return <GuideLayout guide={developerGuide} basePath="/guide/developer" />;
}
