import "./App.css";
import Select from "react-select";
import React, { useState, useEffect, useCallback } from "react";
import Card from "./SummaryCard";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

function formatDateLabel(dateLabel) {
  const date = new Date(dateLabel);
  return Number.isNaN(date.getTime()) ? dateLabel : date.toISOString().slice(0, 10);
}
// The API provides data in a format that is not directly compatible with Chart.js, so we need to transform it into the required format.
// The timeseriesDataMap function takes the raw data fetched from the API and maps it into an array of datasets that can be used by Chart.js. It extracts the cases, deaths, and recovered data, and formats the dates appropriately for the x-axis of the chart.
// The function handles cases where the data might be missing or in a different structure, ensuring that the chart can still be rendered without errors. It also calculates the active cases by subtracting deaths and recovered cases from the total cases.
// The resulting datasets include labels, border colors, and data points that represent the number of active cases, deaths, and recovered cases over time. This allows us to visualize the trends in COVID-19 cases for the selected country effectively.
// The timeseriesDataMap function is crucial for transforming the raw data from the API into a format that can be easily consumed by the Line chart component from Chart.js. It ensures that the data is structured correctly, with appropriate labels and values, allowing for accurate and meaningful visualizations of the COVID-19 trends over time.
// By using this function, we can seamlessly integrate the API data with our charting library and provide users with an informative and visually appealing dashboard to track COVID-19 statistics for different countries.
function timeseriesDataMap(fetchedData) {
  const timeline = fetchedData?.timeline ?? fetchedData ?? {};
  const casesSeries = timeline?.cases ?? {};
  const mortalitySeries = timeline?.deaths ?? {};
  const recoveredSeries = fetchedData?.genesen ?? fetchedData?.recovered ?? {};
  const allDates = Object.keys(casesSeries).sort((leftDate, rightDate) => new Date(leftDate) - new Date(rightDate));

  return [
    {
      label: "aktiv",
      borderColor: "red",
      data: allDates.map((dateLabel) => ({
        x: formatDateLabel(dateLabel),
        y: Math.max((casesSeries[dateLabel] ?? 0) - (mortalitySeries[dateLabel] ?? 0) - (timeline?.recovered?.[dateLabel] ?? 0), 0),
      })),
    },
    {
      label: "Sterblichkeit",
      borderColor: "grey",
      data: Object.entries(mortalitySeries).map(([dateLabel, value]) => ({
        x: formatDateLabel(dateLabel),
        y: value,
      })),
    },
    {
      label: "genesen",
      borderColor: "blue",
      data: Object.entries(timeline?.recovered ?? recoveredSeries).map(([dateLabel, value]) => ({
        x: formatDateLabel(dateLabel),
        y: value,
      })),
    },
  ];
}

function App() {
  const baseUrl = "https://disease.sh/v3/covid-19";
  const timeseriesOptions = {
    responsive: true,
    normalized: true,
    parsing: false,
    plugins: {
      tooltip: {
        enabled: false,
      },
    },
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 0,
      },
    },
  };

  const [countryOptions, setCountryOptions] = useState([]);
  const [activeCountry, setActiveCountry] = useState("Canada");
  const [lastUpdated, setLastUpdated] = useState("");
  const [summaryData, setSummaryData] = useState({});
  const [timeseriesData, setTimeseriesData] = useState({
    datasets: [],
  });

  const getCountries = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/countries?sort=country`);
      const data = await res.json();
      const options = data.map((country) => ({
        value: country.country,
        label: country.country,
      }));

      setCountryOptions(options);
      setActiveCountry((currentCountry) =>
        options.some((option) => option.value === currentCountry)
          ? currentCountry
          : options.find((option) => option.value === "Canada")?.value ?? options[0]?.value ?? "Canada"
      );
    } catch (error) {
      setCountryOptions([{ value: "Canada", label: "Canada" }]);
    }
  }, [baseUrl]);

  const getSummaryData = useCallback(async (country) => {
    try {
      setSummaryData({});
      const res = await fetch(`${baseUrl}/countries/${encodeURIComponent(country)}?strict=true`);
      const data = await res.json();

      setSummaryData(data);
      setLastUpdated(new Date(data.updated).toLocaleString("de-DE"));
    } catch (error) {
      try {
        const fallbackRes = await fetch('/mocks/summary-diseasesh-canada.json');
        const fallbackJson = await fallbackRes.json();
        setSummaryData(fallbackJson);
        setLastUpdated(new Date(fallbackJson.updated).toLocaleString("de-DE"));
      } catch (fallbackError) {
        setSummaryData({});
      }
    }
  }, [baseUrl]);

  const getTimeseriesData = useCallback(async (country) => {
    try {
      const res = await fetch(`${baseUrl}/historical/${encodeURIComponent(country)}?lastdays=all`);

      const data = await res.json();

      setTimeseriesData({ datasets: timeseriesDataMap(data) });
    } catch (error) {
      try {
        const fallbackRes = await fetch('/mocks/timeseries-diseasesh.json');
        const fallbackJson = await fallbackRes.json();
        setTimeseriesData({ datasets: timeseriesDataMap(fallbackJson) });
      } catch (fallbackError) {
        setTimeseriesData({ datasets: [] });
      }
    }
  }, [baseUrl]);

  useEffect(() => {
    getCountries();
  }, [getCountries]);

  useEffect(() => {
    getSummaryData(activeCountry);
    getTimeseriesData(activeCountry);
  }, [activeCountry, getSummaryData, getTimeseriesData]);
  return (
    <div className="App">
      <h1>COVID 19 Dashboard </h1>

      <div className="dashboard-container">
        <div className="dashboard-menu ">
          <Select
            options={countryOptions}
            onChange={(selectedOption) =>
              setActiveCountry(selectedOption.value)
            }
            value={countryOptions.find((option) => option.value === activeCountry) ?? null}
            className="dashboard-select"
          />
          <p className="update-date">
            Last Updated : {lastUpdated}
          </p>
        </div>
        <div className="dashboard-timeseries">
          <Line
            data={timeseriesData}
            options={timeseriesOptions}
            className="line-chart"
          />
        </div>
        <div className="dashboard-summary">
          <Card title="Total Cases" value={summaryData.cases?.toLocaleString?.("de-DE") ?? summaryData.cases} />
          <Card title="Total Recovered" value={summaryData.recovered?.toLocaleString?.("de-DE") ?? summaryData.recovered ?? "not provided"} />
          <Card title="Total Deaths" value={summaryData.deaths?.toLocaleString?.("de-DE") ?? summaryData.deaths} />
          <Card title="Total Active" value={summaryData.active?.toLocaleString?.("de-DE") ?? summaryData.active} />
        </div>
      </div>
    </div>
  );
}

export default App;
