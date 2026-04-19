import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  VIBE_TAGS,
  generateItinerarySchema,
  type BudgetTier,
  type TripType,
  type VibeTag,
} from "@planna/shared";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Field } from "../../src/components/Field";
import { Screen } from "../../src/components/Screen";
import { api, ApiError } from "../../src/lib/api";
import { cacheAnonItinerary } from "../../src/lib/draft";
import { useAuth } from "../../src/lib/auth";
import { colors, spacing, type } from "../../src/theme";

const BUDGETS: { value: BudgetTier; label: string }[] = [
  { value: "budget", label: "Budget" },
  { value: "mid", label: "Mid" },
  { value: "lux", label: "Luxury" },
];

const TRIPS: { value: TripType; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "couple", label: "Couple" },
  { value: "group", label: "Group" },
];

export default function PlannerScreen() {
  const { user } = useAuth();
  const [destination, setDestination] = useState("");
  const [durationDays, setDurationDays] = useState("4");
  const [budget, setBudget] = useState<BudgetTier>("mid");
  const [trip, setTrip] = useState<TripType>("couple");
  const [vibes, setVibes] = useState<VibeTag[]>(["food"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleVibe(t: VibeTag) {
    setVibes((curr) =>
      curr.includes(t) ? curr.filter((x) => x !== t) : curr.length >= 4 ? curr : [...curr, t],
    );
  }

  async function submit() {
    setError(null);
    const parsed = generateItinerarySchema.safeParse({
      destination: destination.trim(),
      durationDays: Number(durationDays),
      budgetTier: budget,
      tripType: trip,
      vibeTags: vibes,
    });
    if (!parsed.success) {
      setError(firstZodMessage(parsed.error.flatten().fieldErrors));
      return;
    }
    setLoading(true);
    try {
      const res = await api.generateItinerary(parsed.data);
      if (!user) await cacheAnonItinerary(res.itinerary);
      router.push({ pathname: "/plan/result", params: { id: res.itinerary.id } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate itinerary.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>TELL US ABOUT YOUR TRIP</Text>

      <Field
        label="Destination"
        placeholder="Tokyo, Lisbon, Mexico City..."
        value={destination}
        onChangeText={setDestination}
        autoCapitalize="words"
      />

      <Field
        label="How many days?"
        placeholder="4"
        value={durationDays}
        onChangeText={(v) => setDurationDays(v.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        hint="1 to 7 days"
      />

      <View style={{ gap: spacing.sm }}>
        <Text style={styles.section}>BUDGET</Text>
        <View style={styles.row}>
          {BUDGETS.map((b) => (
            <Chip
              key={b.value}
              label={b.label}
              selected={budget === b.value}
              onPress={() => setBudget(b.value)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={styles.section}>TRIP TYPE</Text>
        <View style={styles.row}>
          {TRIPS.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              selected={trip === t.value}
              onPress={() => setTrip(t.value)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={styles.section}>VIBE (PICK UP TO 4)</Text>
        <View style={styles.row}>
          {VIBE_TAGS.map((t) => (
            <Chip
              key={t}
              label={t}
              selected={vibes.includes(t)}
              onPress={() => toggleVibe(t)}
            />
          ))}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Generate itinerary" loading={loading} onPress={submit} />
    </Screen>
  );
}

function firstZodMessage(field: Record<string, string[] | undefined>): string {
  for (const msgs of Object.values(field)) {
    if (msgs && msgs.length && msgs[0]) return msgs[0];
  }
  return "Please fill out the form.";
}

const styles = StyleSheet.create({
  eyebrow: { ...type.caption, color: colors.inkMuted, letterSpacing: 2 },
  section: { ...type.caption, color: colors.inkMuted, letterSpacing: 1.5 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  error: { ...type.body, color: colors.danger },
});
