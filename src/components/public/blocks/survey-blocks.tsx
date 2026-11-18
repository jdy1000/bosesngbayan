import { SurveyCarousel } from "@/components/public/blocks/survey-carousel";
import { getHomepageSurveys, type PublicSurvey } from "@/lib/cms/surveys";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";

/** Homepage Surveys band. Renders nothing until a survey is published and switched on for the homepage. */
export async function SurveysBlock({ title, standalone = false, surveys: given }: { title: string | null; standalone?: boolean; surveys?: PublicSurvey[] }) {
  const [surveys, { locale, t }] = await Promise.all([given ?? getHomepageSurveys(), getI18n()]);
  if (surveys.length === 0) return null;
  const b = t.blocks;
  const carousel = (
    <SurveyCarousel
      title={title ?? b.surveys}
      asOf={b.surveyAsOf}
      surveys={surveys.map((s) => ({ ...s, dateLabel: formatDate(s.date, locale) }))}
      labels={{
        overall: b.surveyOverall,
        trust: b.surveyTrust,
        performance: b.surveyPerformance,
        rank: b.surveyRank,
        prev: b.surveyPrev,
        next: b.surveyNext,
        picker: b.surveyPicker,
        scroll: b.surveyScroll,
      }}
    />
  );
  // Under the top stories the grid already provides the container; anywhere else the band needs its own.
  return standalone ? <div className="container-site py-8 md:py-10">{carousel}</div> : carousel;
}
