"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

const fmtDay = (d: string) => {
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
};

/** Per-day chart over zero-filled rows. The parent decides what is plotted; this only renders it. */
export function TrendChart({
  data,
  series,
  kind = "line",
  height = 260,
  ariaLabel,
}: {
  data: Record<string, string | number>[];
  series: TrendSeries[];
  kind?: "line" | "bar";
  height?: number;
  ariaLabel: string;
}) {
  const common = (
    <>
      <CartesianGrid stroke="#dfe5f2" vertical={false} />
      <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fontSize: 12, fill: "#5b6785" }} tickLine={false} axisLine={false} minTickGap={16} />
      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#5b6785" }} tickLine={false} axisLine={false} width={40} />
      <Tooltip
        labelFormatter={(d) => String(d)}
        contentStyle={{ borderRadius: 10, borderColor: "#dfe5f2", fontSize: 13 }}
        cursor={{ fill: "rgba(29,78,216,0.06)" }}
      />
      {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
    </>
  );
  return (
    <div role="img" aria-label={ariaLabel} style={{ width: "100%", height }}>
      <ResponsiveContainer>
        {kind === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {common}
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={28} />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {common}
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={data.length <= 31} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
