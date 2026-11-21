import React from "react";

type Variant = "primary" | "secondary" | "danger" | "danger-solid" | "quiet";
type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Always required: every button says what it does. */
  label: React.ReactNode;
  icon?: React.ReactNode;
  variant?: Variant;
  small?: boolean;
  block?: boolean;
};

const variantClass: Record<Variant, string> = {
  primary: " is-primary",
  secondary: "",
  danger: " is-danger",
  "danger-solid": " is-danger is-solid",
  quiet: " is-quiet",
};

/** 48px labelled button (44px when small). */
export function Button({label, icon, variant = "secondary", small, block, className = "", type = "button", ...rest}: ButtonProps) {
  return <button type={type} className={"ui-btn" + variantClass[variant] + (small ? " is-small" : "") + (block ? " is-block" : "") + (className ? " " + className : "")} {...rest}>
    {icon}{label !== "" && <span>{label}</span>}
  </button>;
}

type IconButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Required accessible name; only use icon buttons for reversible actions. */
  "aria-label": string;
  icon: React.ReactNode;
  variant?: Variant;
};

/** 44px square icon button. */
export function IconButton({icon, variant = "secondary", className = "", type = "button", ...rest}: IconButtonProps) {
  return <button type={type} title={rest.title ?? rest["aria-label"]} className={"ui-btn ui-iconbtn is-small" + variantClass[variant] + (className ? " " + className : "")} {...rest}>{icon}</button>;
}
