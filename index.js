const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { createObjectCsvWriter } = require("csv-writer");
const cron = require("node-cron");

// Define file paths
const filePath = path.join(__dirname, "N717PK Feb Report.csv");
const outputFile = path.join(__dirname, "N717PK Feb Report_with_hours.csv");

// Arrays to store data
const secondColumnData = [];
const urls = [];
const flightData = [];

// Base URL for flight information
const baseURL = "https://www.flightaware.com/live/flight/";

// Function to start the process
async function processData() {
  try {
    // Read CSV file and extract data
    await readCsv();
    // Generate URLs using extracted data
    generateUrls();
    // Start Puppeteer to navigate to each URL
    await startPuppeteer();
    // Write flight data to the CSV file
    writeDataToCsv();
  } catch (error) {
    console.error("Error:", error);
  }
}

// Function to read CSV file and extract data
async function readCsv() {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        const secondColumnName = Object.keys(data)[1];
        secondColumnData.push(data[secondColumnName]);
      })
      .on("end", () => {
        console.log("Extracted Data:", secondColumnData);
        resolve();
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

// Function to generate URLs using extracted data
function generateUrls() {
  secondColumnData.forEach((data) => {
    urls.push(baseURL + data);
    flightData.push(null);
  });
  console.log("Generated URLs:", urls);
}

// Function to start Puppeteer and navigate to each URL
async function startPuppeteer() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  for (let i = 0; i < urls.length; i++) {
    await page.goto(urls[i]);
    console.log("Navigated to:", urls[i]);
    const content = await page.content(); // Get the HTML content of the page
    const flightProgressTotal = extractFlightProgressTotal(content);
    const convertedData = convertToHours(flightProgressTotal);
    flightData[i] = convertedData;
    console.log("Flight Progress Total (hours):", convertedData);
  }
  await browser.close();
  console.log("Flight Data (hours):", flightData);
}

// Function to extract flight progress total from HTML content using Cheerio
function extractFlightProgressTotal(html) {
  const $ = cheerio.load(html);
  const flightProgressTotal = $(".flightPageProgressTotal strong")
    .first()
    .text();
  return flightProgressTotal;
}

// Function to convert flight progress total data to hours
function convertToHours(time) {
  const matches = time.match(/(\d+)\s*h\s*(\d+)?\s*m/);
  if (matches) {
    const hours = matches[1] ? parseInt(matches[1]) : 0;
    const minutes = matches[2] ? parseInt(matches[2]) : 0;
    const totalHours = hours + minutes / 60;
    return totalHours.toFixed(2) + "h";
  } else {
    const matchesMinutes = time.match(/(\d+)\s*m/);
    if (matchesMinutes) {
      const minutes = parseInt(matchesMinutes[1]);
      const hours = minutes / 60;
      return hours.toFixed(2) + "h";
    } else {
      return "Invalid format";
    }
  }
}

// Function to write flight data to the CSV file
function writeDataToCsv() {
  const records = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => {
      records.push(data); // Push original data
    })
    .on("end", () => {
      for (let i = 0; i < records.length - 1; i++) {
        records[i]["Flight Progress Total (hours)"] = flightData[i]; // Assign converted data to each record
      }
      const csvWriter = createObjectCsvWriter({
        path: outputFile,
        header: Object.keys(records[0]).map((header) => ({
          id: header,
          title: header,
        })),
      });
      csvWriter
        .writeRecords(records)
        .then(() => {
          console.log(
            "Data has been written to the CSV file with the new column."
          );
        })
        .catch((err) => {
          console.error("Error writing data to the CSV file:", err);
        });
    });
}

// Schedule the process to run every 2 minutes
cron.schedule("*/2 * * * *", () => {
  console.log("Running the process...");
  processData();
});
