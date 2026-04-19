import { StyleSheet, Text, View } from "react-native";
import type { Itinerary } from "@planna/shared";
import { colors, radius, spacing, type } from "../theme";

export function ItineraryView({ itinerary }: { itinerary: Itinerary }) {
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.meta}>
          {itinerary.destination.toUpperCase()} · {itinerary.durationDays} DAYS ·{" "}
          {itinerary.budgetTier.toUpperCase()}
        </Text>
        <Text style={styles.title}>{itinerary.title}</Text>
        {itinerary.summary ? <Text style={styles.summary}>{itinerary.summary}</Text> : null}
        {itinerary.vibeTags.length ? (
          <View style={styles.tagRow}>
            {itinerary.vibeTags.map((t) => (
              <Text key={t} style={styles.tag}>
                {t}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {itinerary.days.map((day) => (
        <View key={day.dayNumber} style={styles.dayCard}>
          <Text style={styles.dayLabel}>DAY {day.dayNumber}</Text>
          <Text style={styles.dayTitle}>{day.title}</Text>
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            {day.items.map((item) => (
              <View key={item.itemId} style={styles.item}>
                <Text style={styles.itemSlot}>
                  {item.timeSlot.toUpperCase()} · {item.category.toUpperCase()}
                </Text>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.area ? <Text style={styles.itemArea}>{item.area}</Text> : null}
                {item.description ? (
                  <Text style={styles.itemDesc}>{item.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { ...type.caption, color: colors.inkMuted, letterSpacing: 1 },
  title: { ...type.display, color: colors.ink },
  summary: { ...type.body, color: colors.inkMuted },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  tag: {
    ...type.caption,
    color: colors.ink,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  dayLabel: { ...type.caption, color: colors.accent, letterSpacing: 1.5 },
  dayTitle: { ...type.h1, color: colors.ink, marginTop: spacing.xs },
  item: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accentSoft,
    paddingLeft: spacing.md,
    gap: 2,
  },
  itemSlot: { ...type.caption, color: colors.inkMuted, letterSpacing: 1 },
  itemName: { ...type.h2, color: colors.ink },
  itemArea: { ...type.body, color: colors.inkMuted, fontStyle: "italic" },
  itemDesc: { ...type.body, color: colors.ink, marginTop: 2 },
});
