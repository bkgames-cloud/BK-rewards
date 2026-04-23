import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native"
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from "@/lib/legal-text"

function Section(props: { title: string; paragraphs: string[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{props.title}</Text>
      <View style={{ gap: 10 }}>
        {props.paragraphs.map((p, i) => (
          <Text key={`${props.title}-${i}`} style={styles.p}>
            {p}
          </Text>
        ))}
      </View>
    </View>
  )
}

export function LegalNoticesNative(props: { onClose: () => void }) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={props.onClose} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹ Retour</Text>
        </Pressable>
        <Text style={styles.title}>Mentions légales</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>{PRIVACY_POLICY.title}</Text>
        <Text style={styles.intro}>{PRIVACY_POLICY.intro}</Text>
        {PRIVACY_POLICY.sections.map((s) => (
          <Section key={`pp-${s.title}`} title={s.title} paragraphs={s.paragraphs} />
        ))}

        <View style={{ height: 18 }} />

        <Text style={styles.h1}>{TERMS_OF_SERVICE.title}</Text>
        <Text style={styles.intro}>{TERMS_OF_SERVICE.intro}</Text>
        {TERMS_OF_SERVICE.sections.map((s) => (
          <Section key={`tos-${s.title}`} title={s.title} paragraphs={s.paragraphs} />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.10)",
  },
  title: { color: "#fafafa", fontSize: 16, fontWeight: "700" },
  backBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  backTxt: { color: "#d4af37", fontSize: 14, fontWeight: "700" },
  scroll: { padding: 14, paddingBottom: 34, gap: 10 },
  h1: { color: "#fafafa", fontSize: 18, fontWeight: "800", marginTop: 6 },
  intro: { color: "rgba(255,255,255,0.75)", lineHeight: 18, marginBottom: 6 },
  card: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 12,
  },
  cardTitle: { color: "#fafafa", fontSize: 14, fontWeight: "800", marginBottom: 10 },
  p: { color: "rgba(255,255,255,0.78)", fontSize: 12.5, lineHeight: 18 },
})

