import { GuideLayout } from "../../components/guide/GuideLayout";
import { workerGuide } from "../../data/guideContent";

export default function WorkerGuide() {
  return <GuideLayout guide={workerGuide} basePath="/guide/worker" />;
}
