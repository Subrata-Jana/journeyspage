import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass, ShieldCheck } from "lucide-react";

function SectionCard({ title, body, bullets = [] }) {
  const paragraphs = Array.isArray(body) ? body : [body];

  return (
    <article className="rounded-[1.75rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111625] p-6 md:p-7 shadow-sm">
      <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
        {title}
      </h2>
      <div className="mt-4 space-y-4">
        {paragraphs.filter(Boolean).map((paragraph) => (
          <p
            key={paragraph}
            className="text-slate-600 dark:text-slate-300 leading-relaxed"
          >
            {paragraph}
          </p>
        ))}
      </div>
      {bullets.length > 0 && (
        <ul className="mt-5 grid gap-3">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-sm text-slate-700 dark:text-slate-200"
            >
              {bullet}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function PublicPageShell({
  eyebrow,
  title,
  intro,
  highlights = [],
  sections = [],
  asideTitle,
  asideText,
  asidePoints = [],
  ctaTitle,
  ctaText,
  ctaPrimary = { label: "Back Home", to: "/" },
  ctaSecondary = { label: "Join JourneysPage", to: "/register" },
}) {
  return (
    <div className="bg-slate-50 dark:bg-[#0B0F19]">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.18),transparent_28%),linear-gradient(135deg,#0b1220_0%,#0f172a_45%,#172554_100%)]" />
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-16 md:pt-32 md:pb-20">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/12 border border-orange-400/20 text-orange-200 text-xs font-bold uppercase tracking-[0.24em]">
              <Compass size={14} className="text-orange-300" />
              {eyebrow}
            </div>
            <h1 className="mt-6 text-4xl md:text-6xl font-black tracking-tight text-white leading-[0.95]">
              {title}
            </h1>
            <p className="mt-5 max-w-3xl text-base md:text-lg text-slate-200/90 leading-relaxed">
              {intro}
            </p>
          </div>

          {highlights.length > 0 && (
            <div className="mt-10 grid md:grid-cols-3 gap-4">
              {highlights.map((highlight) => (
                <div
                  key={highlight.title}
                  className="rounded-[1.5rem] border border-white/10 bg-black/20 backdrop-blur-md p-5"
                >
                  <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-orange-200 mb-2">
                    {highlight.title}
                  </div>
                  <p className="text-sm text-slate-200/85 leading-relaxed">
                    {highlight.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-14 md:py-16">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
          <div className="space-y-5">
            {sections.map((section) => (
              <SectionCard key={section.title} {...section} />
            ))}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <div className="rounded-[1.75rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111625] p-6 shadow-sm">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-500 text-[11px] font-bold uppercase tracking-[0.2em]">
                <ShieldCheck size={14} />
                Quick Read
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {asideTitle}
              </h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed">
                {asideText}
              </p>
              {asidePoints.length > 0 && (
                <div className="mt-5 grid gap-3">
                  {asidePoints.map((point) => (
                    <div
                      key={point}
                      className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-sm text-slate-700 dark:text-slate-200"
                    >
                      {point}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[1.75rem] overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.22),transparent_35%),linear-gradient(135deg,#101827_0%,#0B0F19_55%,#151b2b_100%)] p-6 shadow-2xl">
              <div className="text-[11px] uppercase tracking-[0.24em] font-bold text-orange-300">
                Recommended Next Step
              </div>
              <h2 className="mt-3 text-2xl font-black text-white leading-tight">
                {ctaTitle}
              </h2>
              <p className="mt-3 text-slate-300 leading-relaxed">
                {ctaText}
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  to={ctaPrimary.to}
                  className="px-5 py-3 rounded-full bg-white text-slate-950 hover:bg-orange-500 hover:text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {ctaPrimary.label} <ArrowRight size={16} />
                </Link>
                <Link
                  to={ctaSecondary.to}
                  className="px-5 py-3 rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/10 font-bold text-sm transition-colors text-center"
                >
                  {ctaSecondary.label}
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
