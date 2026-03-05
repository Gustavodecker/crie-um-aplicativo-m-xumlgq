
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { apiGet } from "@/utils/api";
import { colors } from "@/styles/commonStyles";
import * as ScreenOrientation from 'expo-screen-orientation';
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
  const primaryColor = colors.primary || '#6366F1';
  
  const reportsHTML = reports.map(report => {
    const dayNumberText = `DIA ${report.dayNumber}`;
    const wakeUpText = report.wakeUpTime || "Não registrado";
    const firstNapWindowText = report.firstNapWindow || "N/A";

    let napsHTML = '';
    if (report.naps.length > 0) {
      napsHTML = report.naps.map(nap => {
        const napTitle = `Soneca ${nap.napNumber}`;
        const napDurationText = formatTimeDuration(nap.durationMinutes);
        
        let badgesHTML = '';
        if (nap.sleepMethod || nap.environment || nap.wakeUpMood) {
          const badges = [];
          if (nap.sleepMethod) badges.push(`<span style="background: ${primaryColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; margin-right: 4px;">Dormiu: ${nap.sleepMethod}</span>`);
          if (nap.environment) badges.push(`<span style="background: ${getEnvironmentColor(nap.environment)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; margin-right: 4px;">Ambiente: ${nap.environment}</span>`);
          if (nap.wakeUpMood) badges.push(`<span style="background: ${getMoodColor(nap.wakeUpMood)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; margin-right: 4px;">Acordou: ${nap.wakeUpMood}</span>`);
          badgesHTML = `<div style="margin-top: 6px;">${badges.join('')}</div>`;
        }

        let observationsHTML = '';
        if (nap.observations) {
          observationsHTML = `<div style="background: #f5f5f5; padding: 8px; border-radius: 6px; margin-top: 6px; border-left: 3px solid #999;">
            <div style="font-size: 9px; font-weight: bold; color: #666; margin-bottom: 4px;">OBSERVAÇÕES DA MÃE:</div>
            <div style="font-size: 10px; color: #333;">${nap.observations}</div>
          </div>`;
        }

        let commentsHTML = '';
        if (nap.consultantComments) {
          commentsHTML = `<div style="background: #f5f5f5; padding: 8px; border-radius: 6px; margin-top: 6px; border-left: 3px solid ${primaryColor};">
            <div style="font-size: 9px; font-weight: bold; color: ${primaryColor}; margin-bottom: 4px;">COMENTÁRIOS DA CONSULTORA:</div>
            <div style="font-size: 10px; color: #333;">${nap.consultantComments}</div>
          </div>`;
        }

        return `
          <div style="background: #fafafa; padding: 10px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid ${primaryColor};">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px;">${napTitle}</div>
            <div style="font-size: 11px; margin-bottom: 2px;"><strong>Horário:</strong> ${nap.displayText}</div>
            <div style="font-size: 11px; margin-bottom: 2px;"><strong>Duração:</strong> ${napDurationText}</div>
            <div style="font-size: 11px;">${nap.windowText}</div>
            ${badgesHTML}
            ${observationsHTML}
            ${commentsHTML}
          </div>
        `;
      }).join('');
    }

    let wakingsHTML = '';
    if (report.wakings.length > 0) {
      wakingsHTML = report.wakings.map(waking => {
        const wakingIndexText = `${waking.index}º Despertar`;
        const wakingDurationText = formatTimeDuration(waking.durationMinutes);
        
        let backToSleepHTML = '';
        if (waking.backToSleepMethod) {
          backToSleepHTML = `<div style="margin-top: 4px;"><span style="background: ${primaryColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px;">Voltou a dormir: ${waking.backToSleepMethod}</span></div>`;
        }

        return `
          <div style="background: #fafafa; padding: 10px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid #FF9800;">
            <div style="font-weight: bold; font-size: 11px; margin-bottom: 4px;">${wakingIndexText}</div>
            <div style="font-size: 11px; margin-bottom: 2px;"><strong>Horário:</strong> ${waking.displayText}</div>
            <div style="font-size: 11px;"><strong>Duração:</strong> ${wakingDurationText}</div>
            ${backToSleepHTML}
          </div>
        `;
      }).join('');
    }

    let nightSleepHTML = '';
    if (report.nightSleepStart && report.nightSleepEnd) {
      let nightBadgesHTML = '';
      if (report.nightSleepMethod || report.nightEnvironment || report.nightWakeUpMood) {
        const badges = [];
        if (report.nightSleepMethod) badges.push(`<span style="background: ${primaryColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; margin-right: 4px;">Dormiu: ${report.nightSleepMethod}</span>`);
        if (report.nightEnvironment) badges.push(`<span style="background: ${getEnvironmentColor(report.nightEnvironment)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; margin-right: 4px;">Ambiente: ${report.nightEnvironment}</span>`);
        if (report.nightWakeUpMood) badges.push(`<span style="background: ${getMoodColor(report.nightWakeUpMood)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; margin-right: 4px;">Acordou: ${report.nightWakeUpMood}</span>`);
        nightBadgesHTML = `<div style="margin-top: 6px;">${badges.join('')}</div>`;
      }

      let nightObservationsHTML = '';
      if (report.nightObservations) {
        nightObservationsHTML = `<div style="background: #f5f5f5; padding: 8px; border-radius: 6px; margin-top: 6px; border-left: 3px solid #999;">
          <div style="font-size: 9px; font-weight: bold; color: #666; margin-bottom: 4px;">OBSERVAÇÕES DA MÃE:</div>
          <div style="font-size: 10px; color: #333;">${report.nightObservations}</div>
        </div>`;
      }

      let nightCommentsHTML = '';
      if (report.nightConsultantComments) {
        nightCommentsHTML = `<div style="background: #f5f5f5; padding: 8px; border-radius: 6px; margin-top: 6px; border-left: 3px solid ${primaryColor};">
          <div style="font-size: 9px; font-weight: bold; color: ${primaryColor}; margin-bottom: 4px;">COMENTÁRIOS DA CONSULTORA:</div>
          <div style="font-size: 10px; color: #333;">${report.nightConsultantComments}</div>
        </div>`;
      }

      nightSleepHTML = `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
          <div style="font-size: 11px; font-weight: bold; color: ${primaryColor}; margin-bottom: 6px; text-transform: uppercase;">SONO NOTURNO</div>
          <div style="font-size: 11px; margin-bottom: 2px;"><strong>Início:</strong> ${report.nightSleepStart}</div>
          <div style="font-size: 11px; margin-bottom: 2px;"><strong>Fim:</strong> ${report.nightSleepEnd}</div>
          ${report.nightSleepBrute ? `<div style="font-size: 11px; margin-bottom: 2px;"><strong>Total bruto:</strong> ${report.nightSleepBrute}</div>` : ''}
          ${report.nightSleepLiquidTotal ? `<div style="font-size: 11px; margin-bottom: 2px;"><strong>Total líquido:</strong> <span style="font-weight: bold; color: ${primaryColor};">${report.nightSleepLiquidTotal}</span></div>` : ''}
          ${nightBadgesHTML}
          ${nightObservationsHTML}
          ${nightCommentsHTML}
        </div>
      `;
    }

    let summaryHTML = '';
    if (report.total24h) {
      summaryHTML = `
        <div style="background: ${primaryColor}15; padding: 10px; border-radius: 8px; margin-bottom: 12px; border: 1px solid ${primaryColor}30;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 600;">Sono Diurno:</span>
            <span style="font-size: 11px; font-weight: bold; color: ${primaryColor};">${report.daytimeSleepTotal || '0h'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 600;">Sono Noturno:</span>
            <span style="font-size: 11px; font-weight: bold; color: ${primaryColor};">${report.nightSleepLiquidTotal || '0h'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid ${primaryColor}30; padding-top: 4px; margin-top: 4px;">
            <span style="font-size: 11px; font-weight: bold;">Total 24h:</span>
            <span style="font-size: 12px; font-weight: bold; color: ${primaryColor};">${report.total24h}</span>
          </div>
        </div>
      `;
    }

    return `
      <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid ${primaryColor}; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0;">
          <div style="font-size: 16px; font-weight: bold; color: ${primaryColor};">${dayNumberText}</div>
          <div style="font-size: 12px; color: #666; font-weight: 600;">${report.dateDisplay}</div>
        </div>

        ${summaryHTML}

        <div style="margin-top: 12px;">
          <div style="font-size: 11px; font-weight: bold; color: ${primaryColor}; margin-bottom: 6px; text-transform: uppercase;">ACORDOU</div>
          <div style="font-size: 11px; margin-bottom: 2px;"><strong>Horário:</strong> ${wakeUpText}</div>
          ${report.firstNapWindow ? `<div style="font-size: 11px;"><strong>1ª Janela:</strong> ${firstNapWindowText}</div>` : ''}
        </div>

        ${report.naps.length > 0 ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
            <div style="font-size: 11px; font-weight: bold; color: ${primaryColor}; margin-bottom: 6px; text-transform: uppercase;">SONECAS (${report.naps.length})</div>
            ${napsHTML}
          </div>
        ` : ''}

        ${nightSleepHTML}

        ${report.wakings.length > 0 ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
            <div style="font-size: 11px; font-weight: bold; color: ${primaryColor}; margin-bottom: 6px; text-transform: uppercase;">DESPERTARES NOTURNOS (${report.wakings.length})</div>
            ${wakingsHTML}
          </div>
        ` : ''}

        ${report.motherObservations ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
            <div style="background: #f5f5f5; padding: 8px; border-radius: 6px; border-left: 3px solid #999;">
              <div style="font-size: 9px; font-weight: bold; color: #666; margin-bottom: 4px;">OBSERVAÇÕES DA MÃE (DIA):</div>
              <div style="font-size: 10px; color: #333;">${report.motherObservations}</div>
            </div>
          </div>
        ` : ''}

        ${report.consultantComments ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
            <div style="background: #f5f5f5; padding: 8px; border-radius: 6px; border-left: 3px solid ${primaryColor};">
              <div style="font-size: 9px; font-weight: bold; color: ${primaryColor}; margin-bottom: 4px;">COMENTÁRIOS DA CONSULTORA (DIA):</div>
              <div style="font-size: 10px; color: #333;">${report.consultantComments}</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const currentDate = new Date().toLocaleDateString('pt-BR');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @page {
            size: landscape;
            margin: 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            margin: 0;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid ${primaryColor};
          }
          .header h1 {
            color: ${primaryColor};
            font-size: 24px;
            margin: 0 0 8px 0;
          }
          .header p {
            color: #666;
            font-size: 14px;
            margin: 4px 0;
          }
          .content {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          @media print {
            body {
              background: white;
              padding: 0;
            }
            .content {
              gap: 12px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório de Acompanhamento - ${babyName}</h1>
          <p>Gerado em: ${currentDate}</p>
          <p>Total de dias: ${reports.length}</p>
        </div>
        <div class="content">
          ${reportsHTML}
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
    if (Platform.OS !== 'web') {
      ScreenOrientation.unlockAsync().catch((err) => {
        console.log("[Acompanhamento] Screen orientation unlock not supported:", err.message);
      });
    }

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
    console.log('[Acompanhamento] Starting PDF export');
    
    if (reports.length === 0) {
      Alert.alert('Aviso', 'Não há dados para exportar');
      return;
    }

    try {
      setExportingPDF(true);
      
      const babyNameForPDF = babyName || 'Bebê';
      const html = generatePDFHTML(reports, babyNameForPDF);
      
      console.log('[Acompanhamento] Generating PDF with expo-print');
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
