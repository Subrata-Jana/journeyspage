import React, { useCallback, useEffect, useMemo } from "react";
import AsyncCreatableSelect from "react-select/async-creatable";
import debounce from "lodash/debounce";
import { MapPin } from "lucide-react";

const pickFirstText = (...values) =>
  values.find((value) => typeof value === "string" && value.trim());

function buildSearchTokens(meta) {
  return Array.from(
    new Set(
      [
        meta.placeName,
        meta.locality,
        meta.district,
        meta.state,
        meta.country,
        meta.countryCode,
      ]
        .filter(Boolean)
        .flatMap((value) =>
          String(value)
            .toLowerCase()
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        )
    )
  );
}

function buildDisplayLabel(meta) {
  const parts = [
    meta.placeName || meta.locality || meta.district,
    meta.state,
    meta.country,
  ].filter(Boolean);

  if (parts.length > 0) return parts.join(", ");
  return meta.raw?.display_name || meta.displayLabel || "";
}

function normalizeLocationValue(value = {}, fallbackLabel = "") {
  const raw = value.raw || value.rawData || {};
  const address = raw.address || value.address || {};

  const placeName =
    pickFirstText(
      value.placeName,
      value.name,
      raw.name,
      address.hamlet,
      address.village,
      address.town,
      address.city_district,
      address.suburb,
      address.locality,
      address.city,
      address.county
    ) || fallbackLabel;

  const locality =
    pickFirstText(
      value.locality,
      address.hamlet,
      address.village,
      address.town,
      address.city,
      address.suburb,
      address.locality,
      address.neighbourhood,
      address.municipality
    ) || "";

  const district =
    pickFirstText(
      value.district,
      address.state_district,
      address.county,
      address.region
    ) || "";

  const state = pickFirstText(value.state, address.state, address.region) || "";
  const country = pickFirstText(value.country, address.country) || "";
  const countryCode =
    pickFirstText(value.countryCode, address.country_code)?.toUpperCase() || "";

  const normalized = {
    ...value,
    place_id: value.place_id ?? raw.place_id ?? null,
    lat:
      value.lat !== undefined && value.lat !== null
        ? String(value.lat)
        : raw.lat !== undefined && raw.lat !== null
          ? String(raw.lat)
          : "",
    lon:
      value.lon !== undefined && value.lon !== null
        ? String(value.lon)
        : raw.lon !== undefined && raw.lon !== null
          ? String(raw.lon)
          : "",
    placeName,
    locality,
    district,
    state,
    country,
    countryCode,
    source: value.source || (value.place_id ?? raw.place_id ? "osm" : "manual"),
    raw: Object.keys(raw).length > 0 ? raw : null,
  };

  normalized.displayLabel =
    value.displayLabel || fallbackLabel || buildDisplayLabel(normalized);
  normalized.searchTokens = value.searchTokens || buildSearchTokens(normalized);

  return normalized;
}

function normalizeLocationOption(option) {
  if (!option) return null;

  if (option.label !== undefined && option.value !== undefined) {
    const normalizedValue = normalizeLocationValue(option.value, option.label);
    return {
      ...option,
      label: normalizedValue.displayLabel,
      value: normalizedValue,
    };
  }

  const normalizedValue = normalizeLocationValue(
    option,
    option.displayLabel || option.placeName || ""
  );

  return {
    label: normalizedValue.displayLabel,
    value: normalizedValue,
  };
}

function mapOsmResultToOption(item) {
  const normalizedValue = normalizeLocationValue(
    {
      place_id: item.place_id,
      lat: item.lat,
      lon: item.lon,
      name: item.name,
      source: "osm",
      raw: item,
    },
    item.display_name
  );

  return {
    label: normalizedValue.displayLabel,
    value: normalizedValue,
  };
}

export default function LocationPicker({ value, onChange, disabled, className }) {
  const normalizedValue = useMemo(() => normalizeLocationOption(value), [value]);

  const emitChange = useCallback(
    (nextOption) => {
      onChange?.(nextOption ? normalizeLocationOption(nextOption) : null);
    },
    [onChange]
  );

  const fetchPlaces = useCallback(async (inputValue) => {
    if (!inputValue || inputValue.trim().length < 2) return [];

    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        q: inputValue.trim(),
        addressdetails: "1",
        limit: "8",
        dedupe: "1",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            "User-Agent": "JourneysPage/1.0",
            "Accept-Language": "en",
          },
        }
      );

      if (!response.ok) throw new Error("location-search-failed");

      const data = await response.json();
      return data.map(mapOsmResultToOption);
    } catch (error) {
      console.error("OSM Search Error:", error);
      return [];
    }
  }, []);

  const debouncedLoader = useMemo(
    () =>
      debounce((inputValue, callback) => {
        fetchPlaces(inputValue).then(callback);
      }, 400),
    [fetchPlaces]
  );

  useEffect(() => () => debouncedLoader.cancel(), [debouncedLoader]);

  const loadOptions = useCallback(
    (inputValue, callback) => {
      debouncedLoader(inputValue, callback);
    },
    [debouncedLoader]
  );

  const isManualSelection = normalizedValue?.value?.source === "manual";

  const updateManualField = (field, fieldValue) => {
    if (!normalizedValue) return;

    const nextValue = normalizeLocationValue(
      {
        ...normalizedValue.value,
        [field]: fieldValue,
      },
      normalizedValue.label
    );

    emitChange({
      ...normalizedValue,
      label: buildDisplayLabel(nextValue),
      value: nextValue,
    });
  };

  return (
    <div className={`space-y-2 ${className || ""}`}>
      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1">
        <MapPin size={12} /> Location
      </label>

      <AsyncCreatableSelect
        cacheOptions
        defaultOptions={false}
        isClearable
        allowCreateWhileLoading
        loadOptions={loadOptions}
        onChange={emitChange}
        value={normalizedValue}
        isDisabled={disabled}
        placeholder="Search for a place (e.g. Sandakphu)..."
        classNamePrefix="react-select"
        formatCreateLabel={(inputValue) => `Use "${inputValue}" anyway`}
        getNewOptionData={(inputValue) => {
          const manualValue = normalizeLocationValue(
            {
              placeName: inputValue.trim(),
              displayLabel: inputValue.trim(),
              source: "manual",
            },
            inputValue.trim()
          );

          return {
            label: manualValue.displayLabel,
            value: manualValue,
            __isNew__: true,
          };
        }}
        noOptionsMessage={({ inputValue }) =>
          inputValue?.trim().length < 2
            ? "Type at least 2 letters"
            : "No exact match. Use manual entry if needed."
        }
        styles={{
          control: (base, state) => ({
            ...base,
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            borderRadius: "0.75rem",
            border: state.isFocused
              ? "1px solid #f97316"
              : "1px solid rgba(148, 163, 184, 0.1)",
            padding: "4px",
            boxShadow: "none",
            color: "inherit",
            minHeight: "48px",
          }),
          input: (base) => ({
            ...base,
            color: "inherit",
            fontSize: "1rem",
          }),
          singleValue: (base) => ({
            ...base,
            color: "inherit",
            fontWeight: 600,
          }),
          placeholder: (base) => ({
            ...base,
            color: "#94a3b8",
            fontSize: "0.9rem",
          }),
          menu: (base) => ({
            ...base,
            backgroundColor: "#1e293b",
            zIndex: 9999,
            borderRadius: "0.75rem",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            overflow: "hidden",
          }),
          option: (base, state) => ({
            ...base,
            backgroundColor: state.isFocused ? "#334155" : "transparent",
            color: state.isFocused ? "#fff" : "#cbd5e1",
            cursor: "pointer",
            padding: "10px 14px",
            fontSize: "0.9rem",
          }),
        }}
        theme={(theme) => ({
          ...theme,
          colors: { ...theme.colors, text: "currentColor" },
        })}
      />

      {isManualSelection && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <input
            type="text"
            value={normalizedValue?.value?.state || ""}
            onChange={(event) => updateManualField("state", event.target.value)}
            placeholder="State / Region"
            disabled={disabled}
            className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <input
            type="text"
            value={normalizedValue?.value?.country || ""}
            onChange={(event) => updateManualField("country", event.target.value)}
            placeholder="Country"
            disabled={disabled}
            className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <p className="md:col-span-2 text-[11px] text-slate-500 dark:text-slate-400 ml-1">
            Offbeat place not found? Keep the place name and add state/country
            for better categorization.
          </p>
        </div>
      )}
    </div>
  );
}
