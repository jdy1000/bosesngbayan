"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password field with a show/hide toggle. The toggle is a real button (aria-pressed), never submits the form. */
export function PasswordInput({ className = "field", ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-12`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label="Ipakita ang password"
        aria-pressed={visible}
        title={visible ? "Itago ang password" : "Ipakita ang password"}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r text-muted transition-colors hover:text-ink focus-visible:text-ink"
      >
        {visible ? <EyeOff aria-hidden="true" className="size-[18px]" /> : <Eye aria-hidden="true" className="size-[18px]" />}
      </button>
    </div>
  );
}
