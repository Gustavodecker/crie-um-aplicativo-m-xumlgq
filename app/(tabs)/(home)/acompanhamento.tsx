
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import React, { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/utils/api";
import { colors } from "@/styles/commonStyles";
import { SafeAreaView } from "react-native-safe-area-context";
import { Platform, Dimensions } from "react-native";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";

interface Nap {
  id: string;
  routineId: string;
  napNumber: number;
  startTryTime: string;
  fellAsleepTime: string | null;
  wakeUpTime: string | null;
  sleepMethod: string | null;
  environment: string | null;
  wakeUpMood: string | null;
  observations: string | null;
  consultantComments: string | null;
  createdAt: string;
}

interface NightWaking {
  id: string;
  nightSleepId: string;
  startTime: string;
  endTime: string;
  backToSleepMethod: string | null;
  createdAt: string;
}

interface NightSleep {
  id: string;
  routineId: string;
  startTryTime: string | null;
  fellAsleepTime: string | null;
  finalWakeTime: string | null;
  sleepMethod: string | null;
  environment: string | null;
  wakeUpMood: string | null;
  observations: string | null;
  consultantComments: string | null;
  createdAt: string;
  wakings?: NightWaking[];
}

interface Routine {
  id: string;
  babyId: string;
  date: string;
  wakeUpTime: string;
  motherObservations: string | null;
  consultantComments: string | null;
  createdAt: string;
  updatedAt: string;
  naps?: Nap[];
  nightSleep?: NightSleep | null;
}

interface CalculatedNap {
  napNumber: number;
  startTime: string;
  endTime: string;
  displayText: string;
  windowText: string;
  durationMinutes: number;
  sleepMethod: string | null;
  environment: string | null;
  wakeUpMood: string | null;
  observations: string | null;
  consultantComments: string | null;
}

interface CalculatedWaking {
  index: number;
  displayText: string;
  durationMinutes: number;
  backToSleepMethod: string | null;
}

interface DailyReport {
  dayNumber: number;
  dateDisplay: string;
  wakeUpTime: string | null;
  firstNapWindow: string | null;
  naps: CalculatedNap[];
  daytimeSleepTotal: string | null;
  daytimeSleepMinutes: number;
  nightSleepStart: string | null;
  nightSleepEnd: string | null;
  nightSleepBrute: string | null;
  nightSleepLiquidTotal: string | null;
  nightSleepMinutes: number;
  total24h: string | null;
  total24hMinutes: number;
  wakings: CalculatedWaking[];
  nightSleepMethod: string | null;
  nightEnvironment: string | null;
  nightWakeUpMood: string | null;
  nightObservations: string | null;
  nightConsultantComments: string | null;
  motherObservations: string | null;
  consultantComments: string | null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardLandscape: {
    width: '48%',
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
  },
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  summaryBox: {
    backgroundColor: colors.primary + '15',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primary,
  },
  section: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border + '50',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 100,
  },
  infoText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  napCard: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent || colors.primary,
  },
  napHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  badgeGreen: {
    backgroundColor: '#4CAF50',
  },
  badgeYellow: {
    backgroundColor: '#FFC107',
  },
  badgeRed: {
    backgroundColor: '#F44336',
  },
  badgePrimary: {
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  observationBox: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.textSecondary,
  },
  observationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  observationText: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: "center",
    marginTop: 20,
  },
  wakingCard: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  wakingHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  exportButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function calculateTimeDifference(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function formatTimeDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours}h${minutes.toString().padStart(2, "0")}min`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}min`;
  }
}

function formatDateToBR(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getEnvironmentColor(environment: string | null): string {
  if (!environment) return '#9E9E9E';
  const env = environment.toLowerCase();
  if (env.includes('adequado') && !env.includes('parcial')) return '#4CAF50';
  if (env.includes('parcial')) return '#FFC107';
  return '#F44336';
}

function getMoodColor(mood: string | null): string {
  if (!mood) return '#9E9E9E';
  const m = mood.toLowerCase();
  if (m.includes('bom') || m.includes('sorrindo') || m.includes('calmo')) return '#4CAF50';
  if (m.includes('choroso')) return '#FFC107';
  if (m.includes('irritado')) return '#F44336';
  return '#9E9E9E';
}

function calculateDailyReport(routine: Routine, dayIndex: number): DailyReport {
  console.log(`[Acompanhamento] Calculating report for day ${dayIndex}:`, {
    routineId: routine.id,
    date: routine.date,
    wakeUpTime: routine.wakeUpTime,
    napsCount: routine.naps?.length || 0,
    nightSleep: routine.nightSleep,
  });

  const report: DailyReport = {
    dayNumber: dayIndex,
    dateDisplay: formatDateToBR(routine.date),
    wakeUpTime: routine.wakeUpTime || null,
    firstNapWindow: null,
    naps: [],
    daytimeSleepTotal: null,
    daytimeSleepMinutes: 0,
    nightSleepStart: null,
    nightSleepEnd: null,
    nightSleepBrute: null,
    nightSleepLiquidTotal: null,
    nightSleepMinutes: 0,
    total24h: null,
    total24hMinutes: 0,
    wakings: [],
    nightSleepMethod: null,
    nightEnvironment: null,
    nightWakeUpMood: null,
    nightObservations: null,
    nightConsultantComments: null,
    motherObservations: routine.motherObservations,
    consultantComments: routine.consultantComments,
  };

  const sortedNaps = (routine.naps || [])
    .filter((n) => n.fellAsleepTime && n.wakeUpTime)
    .sort((a, b) => a.napNumber - b.napNumber);

  let totalDaytimeSleep = 0;
  let previousWakeTime = routine.wakeUpTime;

  sortedNaps.forEach((nap, index) => {
    if (!nap.fellAsleepTime || !nap.wakeUpTime) return;

    const napDuration = calculateTimeDifference(nap.fellAsleepTime, nap.wakeUpTime);
    totalDaytimeSleep += napDuration;

    const windowMinutes = previousWakeTime
      ? calculateTimeDifference(previousWakeTime, nap.startTryTime)
      : 0;

    const calculatedNap: CalculatedNap = {
      napNumber: nap.napNumber,
      startTime: nap.fellAsleepTime,
      endTime: nap.wakeUpTime,
      displayText: `${nap.fellAsleepTime} - ${nap.wakeUpTime}`,
      windowText: `Janela: ${formatTimeDuration(windowMinutes)}`,
      durationMinutes: napDuration,
      sleepMethod: nap.sleepMethod,
      environment: nap.environment,
      wakeUpMood: nap.wakeUpMood,
      observations: nap.observations,
      consultantComments: nap.consultantComments,
    };

    report.naps.push(calculatedNap);

    if (index === 0 && previousWakeTime) {
      report.firstNapWindow = formatTimeDuration(windowMinutes);
    }

    previousWakeTime = nap.wakeUpTime;
  });

  if (totalDaytimeSleep > 0) {
    report.daytimeSleepTotal = formatTimeDuration(totalDaytimeSleep);
    report.daytimeSleepMinutes = totalDaytimeSleep;
  }

  const nightSleep = routine.nightSleep;
  console.log(`[Acompanhamento] Night sleep data for day ${dayIndex}:`, nightSleep);

  if (nightSleep && nightSleep.fellAsleepTime && nightSleep.finalWakeTime) {
    report.nightSleepStart = nightSleep.fellAsleepTime;
    report.nightSleepEnd = nightSleep.finalWakeTime;
    report.nightSleepMethod = nightSleep.sleepMethod;
    report.nightEnvironment = nightSleep.environment;
    report.nightWakeUpMood = nightSleep.wakeUpMood;
    report.nightObservations = nightSleep.observations;
    report.nightConsultantComments = nightSleep.consultantComments;

    const bruteDuration = calculateTimeDifference(
      nightSleep.fellAsleepTime,
      nightSleep.finalWakeTime
    );
    report.nightSleepBrute = formatTimeDuration(bruteDuration);

    let totalWakingMinutes = 0;
    const wakings = nightSleep.wakings || [];

    console.log(`[Acompanhamento] Processing ${wakings.length} wakings for day ${dayIndex}`);

    wakings.forEach((waking, index) => {
      if (waking.startTime && waking.endTime) {
        const wakingDuration = calculateTimeDifference(waking.startTime, waking.endTime);
        totalWakingMinutes += wakingDuration;

        const calculatedWaking: CalculatedWaking = {
          index: index + 1,
          displayText: `${waking.startTime} - ${waking.endTime}`,
          durationMinutes: wakingDuration,
          backToSleepMethod: waking.backToSleepMethod || null,
        };

        console.log(`[Acompanhamento] Waking ${index + 1}:`, {
          displayText: calculatedWaking.displayText,
          duration: wakingDuration,
          backToSleepMethod: calculatedWaking.backToSleepMethod,
        });

        report.wakings.push(calculatedWaking);
      }
    });

    const liquidDuration = bruteDuration - totalWakingMinutes;
    report.nightSleepLiquidTotal = formatTimeDuration(liquidDuration);
    report.nightSleepMinutes = liquidDuration;

    console.log(`[Acompanhamento] Night sleep calculated for day ${dayIndex}:`, {
      start: report.nightSleepStart,
      end: report.nightSleepEnd,
      brute: report.nightSleepBrute,
      liquid: report.nightSleepLiquidTotal,
      wakingsCount: report.wakings.length,
      sleepMethod: report.nightSleepMethod,
      environment: report.nightEnvironment,
      wakeUpMood: report.nightWakeUpMood,
    });
  } else {
    console.log(`[Acompanhamento] Night sleep incomplete for day ${dayIndex}:`, {
      fellAsleepTime: nightSleep?.fellAsleepTime,
      finalWakeTime: nightSleep?.finalWakeTime,
    });
  }

  const total24hMinutes = report.daytimeSleepMinutes + report.nightSleepMinutes;
  if (total24hMinutes > 0) {
    report.total24h = formatTimeDuration(total24hMinutes);
    report.total24hMinutes = total24hMinutes;
  }

  return report;
}

function generatePDFHTML(reports: DailyReport[], babyName: string): string {
  console.log('[Acompanhamento] Generating PDF HTML for data export');
  
  const primaryColor = colors.primary || '#6366F1';
  const currentDate = new Date().toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const leftColumnReports = [];
  const rightColumnReports = [];
  
  reports.forEach((report, index) => {
    if (index % 2 === 0) {
      leftColumnReports.push(report);
    } else {
      rightColumnReports.push(report);
    }
  });

  const escapeHtml = (text: string | null) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const generateReportCard = (report: DailyReport) => {
    const dayNumberText = `DIA ${report.dayNumber}`;
    const wakeUpText = report.wakeUpTime || "Não registrado";

    let summaryHTML = '';
    if (report.total24h) {
      summaryHTML = `
        <div class="summary-box">
          <table class="summary-table">
            <tr>
              <td class="summary-label">Sono Diurno:</td>
              <td class="summary-value">${report.daytimeSleepTotal || '0h'}</td>
            </tr>
            <tr>
              <td class="summary-label">Sono Noturno:</td>
              <td class="summary-value">${report.nightSleepLiquidTotal || '0h'}</td>
            </tr>
            <tr class="summary-total">
              <td class="summary-label"><strong>Total 24h:</strong></td>
              <td class="summary-value"><strong>${report.total24h}</strong></td>
            </tr>
          </table>
        </div>
      `;
    }

    let napsHTML = '';
    if (report.naps.length > 0) {
      const napsRows = report.naps.map(nap => {
        const napDurationText = formatTimeDuration(nap.durationMinutes);
        
        let detailsHTML = '';
        if (nap.sleepMethod) detailsHTML += `<div class="detail-item"><strong>Dormiu:</strong> ${escapeHtml(nap.sleepMethod)}</div>`;
        if (nap.environment) detailsHTML += `<div class="detail-item"><strong>Ambiente:</strong> ${escapeHtml(nap.environment)}</div>`;
        if (nap.wakeUpMood) detailsHTML += `<div class="detail-item"><strong>Acordou:</strong> ${escapeHtml(nap.wakeUpMood)}</div>`;
        if (nap.observations) detailsHTML += `<div class="detail-item"><strong>Obs. Mãe:</strong> ${escapeHtml(nap.observations)}</div>`;
        if (nap.consultantComments) detailsHTML += `<div class="detail-item"><strong>Comentário Consultora:</strong> ${escapeHtml(nap.consultantComments)}</div>`;

        return `
          <tr>
            <td>Soneca ${nap.napNumber}</td>
            <td>${nap.displayText}</td>
            <td>${napDurationText}</td>
            <td>${nap.windowText}</td>
            <td>${detailsHTML || '-'}</td>
          </tr>
        `;
      }).join('');

      napsHTML = `
        <div class="section">
          <h3 class="section-title">SONECAS (${report.naps.length})</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Soneca</th>
                <th>Horário</th>
                <th>Duração</th>
                <th>Janela</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              ${napsRows}
            </tbody>
          </table>
        </div>
      `;
    }

    let nightSleepHTML = '';
    if (report.nightSleepStart && report.nightSleepEnd) {
      let detailsHTML = '';
      if (report.nightSleepMethod) detailsHTML += `<div class="detail-item"><strong>Dormiu:</strong> ${escapeHtml(report.nightSleepMethod)}</div>`;
      if (report.nightEnvironment) detailsHTML += `<div class="detail-item"><strong>Ambiente:</strong> ${escapeHtml(report.nightEnvironment)}</div>`;
      if (report.nightWakeUpMood) detailsHTML += `<div class="detail-item"><strong>Acordou:</strong> ${escapeHtml(report.nightWakeUpMood)}</div>`;
      if (report.nightObservations) detailsHTML += `<div class="detail-item"><strong>Obs. Mãe:</strong> ${escapeHtml(report.nightObservations)}</div>`;
      if (report.nightConsultantComments) detailsHTML += `<div class="detail-item"><strong>Comentário Consultora:</strong> ${escapeHtml(report.nightConsultantComments)}</div>`;

      nightSleepHTML = `
        <div class="section">
          <h3 class="section-title">SONO NOTURNO</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Início</th>
                <th>Fim</th>
                <th>Total Bruto</th>
                <th>Total Líquido</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${report.nightSleepStart}</td>
                <td>${report.nightSleepEnd}</td>
                <td>${report.nightSleepBrute || '-'}</td>
                <td><strong>${report.nightSleepLiquidTotal || '-'}</strong></td>
                <td>${detailsHTML || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    let wakingsHTML = '';
    if (report.wakings.length > 0) {
      const wakingsRows = report.wakings.map(waking => {
        const wakingDurationText = formatTimeDuration(waking.durationMinutes);
        const backToSleepText = waking.backToSleepMethod ? escapeHtml(waking.backToSleepMethod) : '-';
        
        return `
          <tr>
            <td>${waking.index}º Despertar</td>
            <td>${waking.displayText}</td>
            <td>${wakingDurationText}</td>
            <td>${backToSleepText}</td>
          </tr>
        `;
      }).join('');

      wakingsHTML = `
        <div class="section">
          <h3 class="section-title">DESPERTARES NOTURNOS (${report.wakings.length})</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Despertar</th>
                <th>Horário</th>
                <th>Duração</th>
                <th>Voltou a Dormir</th>
              </tr>
            </thead>
            <tbody>
              ${wakingsRows}
            </tbody>
          </table>
        </div>
      `;
    }

    let observationsHTML = '';
    if (report.motherObservations || report.consultantComments) {
      observationsHTML = '<div class="section"><h3 class="section-title">OBSERVAÇÕES DO DIA</h3>';
      if (report.motherObservations) {
        observationsHTML += `<div class="observation-box"><strong>Mãe:</strong> ${escapeHtml(report.motherObservations)}</div>`;
      }
      if (report.consultantComments) {
        observationsHTML += `<div class="observation-box consultant"><strong>Consultora:</strong> ${escapeHtml(report.consultantComments)}</div>`;
      }
      observationsHTML += '</div>';
    }

    return `
      <div class="card">
        <div class="card-header">
          <h2 class="day-title">${dayNumberText}</h2>
          <span class="date-text">${report.dateDisplay}</span>
        </div>

        ${summaryHTML}

        <div class="section">
          <h3 class="section-title">ACORDOU</h3>
          <table class="data-table">
            <tbody>
              <tr>
                <td><strong>Horário:</strong></td>
                <td>${wakeUpText}</td>
                ${report.firstNapWindow ? `<td><strong>1ª Janela:</strong></td><td>${report.firstNapWindow}</td>` : '<td colspan="2"></td>'}
              </tr>
            </tbody>
          </table>
        </div>

        ${napsHTML}
        ${nightSleepHTML}
        ${wakingsHTML}
        ${observationsHTML}
      </div>
    `;
  };

  const leftColumnHTML = leftColumnReports.map(generateReportCard).join('');
  const rightColumnHTML = rightColumnReports.map(generateReportCard).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @page {
            size: landscape;
            margin: 8mm;
          }
          
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #ffffff;
            padding: 8px;
            font-size: 8px;
            line-height: 1.2;
            color: #333;
          }
          
          .header {
            text-align: center;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 2px solid ${primaryColor};
          }
          
          .header h1 {
            color: ${primaryColor};
            font-size: 16px;
            margin-bottom: 3px;
            font-weight: 700;
          }
          
          .header p {
            color: #666;
            font-size: 9px;
            margin: 2px 0;
          }
          
          .columns-container {
            display: flex;
            gap: 8px;
            justify-content: space-between;
          }
          
          .column {
            width: 49.5%;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .card {
            background: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 8px;
            border-left: 3px solid ${primaryColor};
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e0e0e0;
          }
          
          .day-title {
            font-size: 11px;
            font-weight: bold;
            color: ${primaryColor};
            margin: 0;
          }
          
          .date-text {
            font-size: 8px;
            color: #666;
            font-weight: 600;
          }
          
          .summary-box {
            background: ${primaryColor}10;
            border: 1px solid ${primaryColor}30;
            border-radius: 4px;
            padding: 5px;
            margin-bottom: 6px;
          }
          
          .summary-table {
            width: 100%;
            border-collapse: collapse;
          }
          
          .summary-table td {
            padding: 2px 4px;
            font-size: 8px;
          }
          
          .summary-label {
            color: #555;
          }
          
          .summary-value {
            text-align: right;
            font-weight: bold;
            color: ${primaryColor};
          }
          
          .summary-total td {
            border-top: 1px solid ${primaryColor}30;
            padding-top: 3px;
            margin-top: 2px;
          }
          
          .section {
            margin-top: 6px;
          }
          
          .section-title {
            font-size: 9px;
            font-weight: bold;
            color: ${primaryColor};
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 3px;
            font-size: 7px;
          }
          
          .data-table th {
            background: ${primaryColor}15;
            color: ${primaryColor};
            font-weight: bold;
            padding: 3px 4px;
            text-align: left;
            border: 1px solid ${primaryColor}30;
            font-size: 7px;
          }
          
          .data-table td {
            padding: 3px 4px;
            border: 1px solid #e0e0e0;
            vertical-align: top;
          }
          
          .data-table tbody tr:nth-child(even) {
            background: #f9f9f9;
          }
          
          .detail-item {
            margin-bottom: 2px;
            line-height: 1.3;
          }
          
          .observation-box {
            background: #f5f5f5;
            border-left: 2px solid #999;
            border-radius: 3px;
            padding: 4px;
            margin-top: 3px;
            font-size: 7px;
            line-height: 1.3;
          }
          
          .observation-box.consultant {
            border-left-color: ${primaryColor};
            background: ${primaryColor}08;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
            }
            
            .card {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório de Acompanhamento - ${escapeHtml(babyName)}</h1>
          <p>Gerado em: ${currentDate} | Total de dias: ${reports.length}</p>
        </div>
        
        <div class="columns-container">
          <div class="column">
            ${leftColumnHTML}
          </div>
          <div class="column">
            ${rightColumnHTML}
          </div>
        </div>
      </body>
    </html>
  `;
}

export default function AcompanhamentoScreen() {
  const { babyId, babyName } = useLocalSearchParams<{ babyId: string; babyName?: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLandscape, setIsLandscape] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const normalizeNightSleep = useCallback((raw: any): NightSleep | null => {
    if (!raw) {
      console.log("[Acompanhamento] normalizeNightSleep: raw is null/undefined");
      return null;
    }

    if (Array.isArray(raw)) {
      if (raw.length === 0) {
        console.log("[Acompanhamento] normalizeNightSleep: empty array");
        return null;
      }
      const sorted = [...raw].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      raw = sorted[0];
      console.log("[Acompanhamento] normalizeNightSleep: using most recent from array", raw.id);
    }

    if (typeof raw === "object" && !raw.id) {
      console.log("[Acompanhamento] normalizeNightSleep: empty object without ID");
      return null;
    }

    const wakings = Array.isArray(raw.wakings) ? raw.wakings : [];

    const normalized: NightSleep = {
      id: raw.id,
      routineId: raw.routineId,
      startTryTime: raw.startTryTime || null,
      fellAsleepTime: raw.fellAsleepTime || null,
      finalWakeTime: raw.finalWakeTime || null,
      observations: raw.observations || null,
      consultantComments: raw.consultantComments || null,
      sleepMethod: raw.sleepMethod || null,
      environment: raw.environment || null,
      wakeUpMood: raw.wakeUpMood || null,
      wakings: wakings,
      createdAt: raw.createdAt,
    };

    console.log("[Acompanhamento] normalizeNightSleep: normalized", {
      id: normalized.id,
      fellAsleepTime: normalized.fellAsleepTime,
      finalWakeTime: normalized.finalWakeTime,
      wakingsCount: normalized.wakings?.length || 0,
      sleepMethod: normalized.sleepMethod,
      environment: normalized.environment,
      wakeUpMood: normalized.wakeUpMood,
    });

    return normalized;
  }, []);

  const loadData = useCallback(async () => {
    if (!babyId) {
      setError("ID do bebê não fornecido");
      setLoading(false);
      return;
    }

    console.log("[Acompanhamento] Loading data for babyId:", babyId);

    try {
      setLoading(true);
      setError(null);

      const routinesData = await apiGet<Routine[]>(`/api/routines/baby/${babyId}`);
      console.log("[Acompanhamento] Fetched routines:", routinesData.length);

      const routinesWithCompleteData: Routine[] = [];

      for (const routine of routinesData) {
        console.log(`[Acompanhamento] Processing routine ${routine.id}:`, {
          date: routine.date,
          nightSleepRaw: routine.nightSleep,
        });

        let completeRoutine = { ...routine };

        const nightSleepNormalized = normalizeNightSleep(routine.nightSleep);

        if (!nightSleepNormalized || !nightSleepNormalized.fellAsleepTime) {
          console.log(`[Acompanhamento] Night sleep incomplete for routine ${routine.id}, fetching individual routine`);
          
          try {
            const individualRoutine = await apiGet<Routine>(`/api/routines/${routine.id}`);
            console.log(`[Acompanhamento] Individual routine fetched for ${routine.id}:`, {
              nightSleep: individualRoutine.nightSleep,
            });

            const individualNightSleep = normalizeNightSleep(individualRoutine.nightSleep);
            completeRoutine = {
              ...individualRoutine,
              nightSleep: individualNightSleep,
            };
          } catch (err) {
            console.error(`[Acompanhamento] Failed to fetch individual routine ${routine.id}:`, err);
            completeRoutine.nightSleep = nightSleepNormalized;
          }
        } else {
          completeRoutine.nightSleep = nightSleepNormalized;
        }

        routinesWithCompleteData.push(completeRoutine);
      }

      const filledRoutines = routinesWithCompleteData.filter((r) => {
        const hasNapData = r.naps && r.naps.length > 0;
        const hasNightSleepData =
          r.nightSleep &&
          (r.nightSleep.fellAsleepTime ||
            r.nightSleep.finalWakeTime ||
            (r.nightSleep.wakings && r.nightSleep.wakings.length > 0));
        return hasNapData || hasNightSleepData;
      });

      console.log("[Acompanhamento] Filtered routines with data:", filledRoutines.length);

      const sortedRoutines = filledRoutines.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const calculatedReports = sortedRoutines.map((routine, index) =>
        calculateDailyReport(routine, index + 1)
      );

      console.log("[Acompanhamento] Calculated reports:", calculatedReports.length);
      setReports(calculatedReports);
    } catch (err) {
      console.error("[Acompanhamento] Error loading data:", err);
      setError("Erro ao carregar dados de acompanhamento");
    } finally {
      setLoading(false);
    }
  }, [babyId, normalizeNightSleep]);

  useEffect(() => {
    const updateOrientation = () => {
      const { width, height } = Dimensions.get('window');
      setIsLandscape(width > height);
    };

    updateOrientation();
    const subscription = Dimensions.addEventListener('change', updateOrientation);

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (babyId) {
      loadData();
    }
  }, [babyId, loadData]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleExportPDF = useCallback(async () => {
    console.log('[Acompanhamento] Starting PDF data export');
    
    if (reports.length === 0) {
      Alert.alert('Aviso', 'Não há dados para exportar');
      return;
    }

    try {
      setExportingPDF(true);
      
      const babyNameForPDF = babyName || 'Bebê';
      const html = generatePDFHTML(reports, babyNameForPDF);
      
      console.log('[Acompanhamento] Generating PDF with structured data');
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      
      console.log('[Acompanhamento] PDF generated at:', uri);
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        console.log('[Acompanhamento] Sharing PDF');
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Acompanhamento - ${babyNameForPDF}`,
          UTI: 'com.adobe.pdf',
        });
        console.log('[Acompanhamento] PDF shared successfully');
      } else {
        Alert.alert('Sucesso', `PDF gerado em: ${uri}`);
      }
    } catch (err) {
      console.error('[Acompanhamento] Error exporting PDF:', err);
      Alert.alert('Erro', 'Não foi possível exportar o PDF');
    } finally {
      setExportingPDF(false);
    }
  }, [reports, babyName]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: "Acompanhamento",
            headerLeft: () => (
              <TouchableOpacity onPress={handleBack}>
                <IconSymbol
                  ios_icon_name="chevron.left"
                  android_material_icon_name="arrow-back"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: "Acompanhamento",
            headerLeft: () => (
              <TouchableOpacity onPress={handleBack}>
                <IconSymbol
                  ios_icon_name="chevron.left"
                  android_material_icon_name="arrow-back"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            ),
          }}
        />
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Acompanhamento",
          headerLeft: () => (
            <TouchableOpacity onPress={handleBack}>
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity 
              style={styles.exportButton} 
              onPress={handleExportPDF}
              disabled={exportingPDF}
            >
              {exportingPDF ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.exportButtonText}>Exportar PDF</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {reports.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum dado de rotina disponível</Text>
        ) : (
          <View style={isLandscape ? styles.cardsRow : undefined}>
            {reports.map((report) => {
              const dayNumberText = `DIA ${report.dayNumber}`;
              const wakeUpText = report.wakeUpTime || "Não registrado";
              const firstNapWindowText = report.firstNapWindow || "N/A";

              return (
                <View 
                  key={report.dayNumber} 
                  style={[styles.card, isLandscape && styles.cardLandscape]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.dayTitle}>{dayNumberText}</Text>
                    <Text style={styles.dateText}>{report.dateDisplay}</Text>
                  </View>

                  {report.total24h && (
                    <View style={styles.summaryBox}>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Sono Diurno:</Text>
                        <Text style={styles.summaryValue}>{report.daytimeSleepTotal || '0h'}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Sono Noturno:</Text>
                        <Text style={styles.summaryValue}>{report.nightSleepLiquidTotal || '0h'}</Text>
                      </View>
                      <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.primary + '30', paddingTop: 6, marginTop: 6 }]}>
                        <Text style={[styles.summaryLabel, { fontWeight: 'bold' }]}>Total 24h:</Text>
                        <Text style={[styles.summaryValue, { fontSize: 15, fontWeight: 'bold' }]}>{report.total24h}</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ACORDOU</Text>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Horário:</Text>
                      <Text style={styles.infoText}>{wakeUpText}</Text>
                    </View>
                    {report.firstNapWindow && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>1ª Janela:</Text>
                        <Text style={styles.infoText}>{firstNapWindowText}</Text>
                      </View>
                    )}
                  </View>

                  {report.naps.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>SONECAS ({report.naps.length})</Text>
                      {report.naps.map((nap) => {
                        const napTitle = `Soneca ${nap.napNumber}`;
                        const napDurationText = formatTimeDuration(nap.durationMinutes);

                        return (
                          <View key={nap.napNumber} style={styles.napCard}>
                            <Text style={styles.napHeader}>{napTitle}</Text>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Horário:</Text>
                              <Text style={styles.infoText}>{nap.displayText}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Duração:</Text>
                              <Text style={styles.infoText}>{napDurationText}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>{nap.windowText}</Text>
                            </View>

                            {(nap.sleepMethod || nap.environment || nap.wakeUpMood) && (
                              <View style={styles.badgesRow}>
                                {nap.sleepMethod && (
                                  <View style={[styles.badge, styles.badgePrimary]}>
                                    <Text style={styles.badgeText}>Dormiu: {nap.sleepMethod}</Text>
                                  </View>
                                )}
                                {nap.environment && (
                                  <View style={[styles.badge, { backgroundColor: getEnvironmentColor(nap.environment) }]}>
                                    <Text style={styles.badgeText}>Ambiente: {nap.environment}</Text>
                                  </View>
                                )}
                                {nap.wakeUpMood && (
                                  <View style={[styles.badge, { backgroundColor: getMoodColor(nap.wakeUpMood) }]}>
                                    <Text style={styles.badgeText}>Acordou: {nap.wakeUpMood}</Text>
                                  </View>
                                )}
                              </View>
                            )}

                            {nap.observations && (
                              <View style={styles.observationBox}>
                                <Text style={styles.observationLabel}>Observações da Mãe:</Text>
                                <Text style={styles.observationText}>{nap.observations}</Text>
                              </View>
                            )}

                            {nap.consultantComments && (
                              <View style={[styles.observationBox, { borderLeftColor: colors.primary }]}>
                                <Text style={[styles.observationLabel, { color: colors.primary }]}>Comentários da Consultora:</Text>
                                <Text style={styles.observationText}>{nap.consultantComments}</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {report.nightSleepStart && report.nightSleepEnd && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>SONO NOTURNO</Text>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Início:</Text>
                        <Text style={styles.infoText}>{report.nightSleepStart}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Fim:</Text>
                        <Text style={styles.infoText}>{report.nightSleepEnd}</Text>
                      </View>
                      {report.nightSleepBrute && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Total bruto:</Text>
                          <Text style={styles.infoText}>{report.nightSleepBrute}</Text>
                        </View>
                      )}
                      {report.nightSleepLiquidTotal && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Total líquido:</Text>
                          <Text style={[styles.infoText, { fontWeight: 'bold', color: colors.primary }]}>{report.nightSleepLiquidTotal}</Text>
                        </View>
                      )}

                      {(report.nightSleepMethod || report.nightEnvironment || report.nightWakeUpMood) && (
                        <View style={styles.badgesRow}>
                          {report.nightSleepMethod && (
                            <View style={[styles.badge, styles.badgePrimary]}>
                              <Text style={styles.badgeText}>Dormiu: {report.nightSleepMethod}</Text>
                            </View>
                          )}
                          {report.nightEnvironment && (
                            <View style={[styles.badge, { backgroundColor: getEnvironmentColor(report.nightEnvironment) }]}>
                              <Text style={styles.badgeText}>Ambiente: {report.nightEnvironment}</Text>
                            </View>
                          )}
                          {report.nightWakeUpMood && (
                            <View style={[styles.badge, { backgroundColor: getMoodColor(report.nightWakeUpMood) }]}>
                              <Text style={styles.badgeText}>Acordou: {report.nightWakeUpMood}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {report.nightObservations && (
                        <View style={styles.observationBox}>
                          <Text style={styles.observationLabel}>Observações da Mãe:</Text>
                          <Text style={styles.observationText}>{report.nightObservations}</Text>
                        </View>
                      )}

                      {report.nightConsultantComments && (
                        <View style={[styles.observationBox, { borderLeftColor: colors.primary }]}>
                          <Text style={[styles.observationLabel, { color: colors.primary }]}>Comentários da Consultora:</Text>
                          <Text style={styles.observationText}>{report.nightConsultantComments}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {report.wakings.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>DESPERTARES NOTURNOS ({report.wakings.length})</Text>
                      {report.wakings.map((waking) => {
                        const wakingIndexText = `${waking.index}º Despertar`;
                        const wakingDurationText = formatTimeDuration(waking.durationMinutes);

                        return (
                          <View key={waking.index} style={styles.wakingCard}>
                            <Text style={styles.wakingHeader}>{wakingIndexText}</Text>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Horário:</Text>
                              <Text style={styles.infoText}>{waking.displayText}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Duração:</Text>
                              <Text style={styles.infoText}>{wakingDurationText}</Text>
                            </View>
                            {waking.backToSleepMethod && (
                              <View style={styles.badgesRow}>
                                <View style={[styles.badge, styles.badgePrimary]}>
                                  <Text style={styles.badgeText}>Voltou a dormir: {waking.backToSleepMethod}</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {report.motherObservations && (
                    <View style={styles.section}>
                      <View style={styles.observationBox}>
                        <Text style={styles.observationLabel}>Observações da Mãe (Dia):</Text>
                        <Text style={styles.observationText}>{report.motherObservations}</Text>
                      </View>
                    </View>
                  )}

                  {report.consultantComments && (
                    <View style={styles.section}>
                      <View style={[styles.observationBox, { borderLeftColor: colors.primary }]}>
                        <Text style={[styles.observationLabel, { color: colors.primary }]}>Comentários da Consultora (Dia):</Text>
                        <Text style={styles.observationText}>{report.consultantComments}</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
