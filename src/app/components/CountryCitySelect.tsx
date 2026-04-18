import { useMemo } from "react";
import Select, { type SingleValue, components as RSComponents } from "react-select";
import CreatableSelect from "react-select/creatable";
import type { AppLocale } from "@/lib/locations/types";
import {
  cityLabel,
  getCountryNameForLocale,
  listAllCountryCodes,
  listCitiesForCountry,
} from "@/lib/locations/dataset";
import { flagEmojiFromCountryCode } from "@/lib/locations/flagEmoji";
import { inbiteLocationSelectStyles } from "@/lib/locations/selectStyles";

type CountryOption = { value: string; label: string; flag: string };
type CityOption = { value: string; label: string };

export type CountryCitySelectLabels = {
  country: string;
  city: string;
  searchCountry: string;
  searchCity: string;
  createCity: string;
};

export type CountryCitySelectProps = {
  locale: AppLocale;
  countryCode: string;
  cityEn: string;
  onChange: (next: { countryCode: string; cityEn: string }) => void;
  labels: CountryCitySelectLabels;
  /** Prefer this for i18n interpolation (e.g. `t("locationPicker.createCity", { city })`). */
  formatCreateCityLabel?: (input: string) => string;
};

const CountrySingleValue = (props: RSComponents.SingleValueProps<CountryOption, false>) => (
  <RSComponents.SingleValue {...props}>
    <span className="flex items-center gap-2">
      <span aria-hidden>{props.data.flag}</span>
      <span>{props.data.label}</span>
    </span>
  </RSComponents.SingleValue>
);

const CountryOptionRow = (props: RSComponents.OptionProps<CountryOption, false>) => (
  <RSComponents.Option {...props}>
    <span className="flex items-center gap-2">
      <span aria-hidden>{props.data.flag}</span>
      <span>{props.data.label}</span>
    </span>
  </RSComponents.Option>
);

export function CountryCitySelect({
  locale,
  countryCode,
  cityEn,
  onChange,
  labels,
  formatCreateCityLabel,
}: CountryCitySelectProps) {
  const countryOptions = useMemo(() => {
    const codes = listAllCountryCodes();
    const opts: CountryOption[] = codes.map((code) => ({
      value: code,
      label: getCountryNameForLocale(code, locale),
      flag: flagEmojiFromCountryCode(code),
    }));
    opts.sort((a, b) =>
      a.label.localeCompare(
        b.label,
        locale === "ko" || locale === "de" || locale === "ja" || locale === "zh" ? locale : "en",
      ),
    );
    return opts;
  }, [locale]);

  const cityOptions = useMemo(() => {
    return listCitiesForCountry(countryCode).map((c) => ({
      value: c.en,
      label: cityLabel(c, locale),
    }));
  }, [countryCode, locale]);

  const countryValue = useMemo(
    () => countryOptions.find((o) => o.value === countryCode) ?? null,
    [countryCode, countryOptions],
  );

  const cityValue: CityOption | null = useMemo(() => {
    if (!cityEn.trim()) return null;
    const fromList = cityOptions.find((o) => o.value === cityEn);
    if (fromList) return fromList;
    return { value: cityEn, label: cityEn };
  }, [cityEn, cityOptions]);

  const selectStyles = useMemo(() => inbiteLocationSelectStyles<CountryOption>(), []);
  const cityStyles = useMemo(() => inbiteLocationSelectStyles<CityOption>(), []);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[12px] font-semibold text-[#A0522D]/70">{labels.country}</div>
        <div className="mt-2">
          <Select<CountryOption, false>
            instanceId="inbite-country"
            isSearchable
            options={countryOptions}
            value={countryValue}
            onChange={(opt: SingleValue<CountryOption>) => {
              if (!opt) return;
              const nextCode = opt.value;
              const cities = listCitiesForCountry(nextCode);
              const keep = cities.some((c) => c.en === cityEn);
              const nextCity = keep ? cityEn : (cities[0]?.en ?? "");
              onChange({ countryCode: nextCode, cityEn: nextCity });
            }}
            placeholder={labels.searchCountry}
            styles={selectStyles}
            components={{ SingleValue: CountrySingleValue, Option: CountryOptionRow }}
            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            menuPosition="fixed"
            classNames={{ menuPortal: () => "!z-[10050]" }}
          />
        </div>
      </div>

      <div>
        <div className="text-[12px] font-semibold text-[#A0522D]/70">{labels.city}</div>
        <div className="mt-2">
          <CreatableSelect<CityOption, false>
            instanceId="inbite-city"
            isSearchable
            options={cityOptions}
            value={cityValue}
            isDisabled={!countryCode}
            onChange={(opt: SingleValue<CityOption>) => {
              if (!opt) return;
              onChange({ countryCode, cityEn: opt.value.trim() });
            }}
            onCreateOption={(input) => {
              const v = input.trim();
              if (!v) return;
              onChange({ countryCode, cityEn: v });
            }}
            formatCreateLabel={(input) => {
              const v = input.trim();
              return formatCreateCityLabel ? formatCreateCityLabel(v) : labels.createCity.replace("{{city}}", v);
            }}
            placeholder={labels.searchCity}
            styles={cityStyles}
            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            menuPosition="fixed"
            classNames={{ menuPortal: () => "!z-[10050]" }}
          />
        </div>
      </div>
    </div>
  );
}
