import type { StylesConfig } from "react-select";

const terracotta = "#A0522D";
const border = "#EDD5C0";
const bg = "rgba(255,255,255,0.65)";

export function inbiteLocationSelectStyles<T>(): StylesConfig<T, false> {
  return {
    control: (base, state) => ({
      ...base,
      minHeight: 46,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: state.isFocused ? terracotta : border,
      boxShadow: state.isFocused ? `0 0 0 1px ${terracotta}` : "none",
      backgroundColor: bg,
      cursor: "pointer",
      "&:hover": { borderColor: terracotta },
    }),
    valueContainer: (base) => ({ ...base, padding: "2px 12px" }),
    singleValue: (base) => ({ ...base, color: terracotta, fontSize: 14, fontWeight: 500 }),
    placeholder: (base) => ({ ...base, color: "rgba(160,82,45,0.45)", fontSize: 14 }),
    input: (base) => ({ ...base, color: terracotta }),
    menu: (base) => ({
      ...base,
      borderRadius: 14,
      border: `1px solid ${border}`,
      overflow: "hidden",
      boxShadow: "0 12px 32px rgba(42,36,32,0.12)",
      zIndex: 20,
    }),
    menuList: (base) => ({ ...base, padding: 4, maxHeight: 220 }),
    option: (base, state) => ({
      ...base,
      borderRadius: 10,
      margin: "2px 0",
      fontSize: 14,
      cursor: "pointer",
      color: terracotta,
      backgroundColor: state.isSelected
        ? "rgba(160,82,45,0.18)"
        : state.isFocused
          ? "rgba(160,82,45,0.08)"
          : "transparent",
      fontWeight: state.isSelected ? 600 : 500,
    }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: terracotta,
      opacity: state.isFocused ? 1 : 0.65,
      "&:hover": { color: terracotta },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: terracotta,
      opacity: 0.7,
      "&:hover": { color: terracotta, opacity: 1 },
    }),
  };
}
