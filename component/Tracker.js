import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView
} from "react-native";
import { db, auth } from "../firebaseConfig";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import theme from "../src/theme";
import CustomHeader from "./CustomHeader";

const SERVER_URL = "http://172.16.201.190:3000"; // ← update this

export default function Tracker({ navigation }) {
  const [notes, setNotes] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [noteSummary, setNoteSummary] = useState("");
  const [noteSummaryLoading, setNoteSummaryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");

  // ─── One real-time subscription for *all* this client's notes ────────────────
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const notesQ = query(
      collection(db, "consultationNotes"),
      where("clientId", "==", user.uid),
      orderBy("createdAt", "desc") // Always order by createdAt
    );

    const unsubscribe = onSnapshot(
      notesQ,
      snapshot => {
        const allNotes = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate() ?? new Date(),
          };
        });

        setNotes(allNotes);

        // Build unique doctor list from notes
        const map = {};
        allNotes.forEach(n => {
          if (n.consultantId && n.consultantName) {
            map[n.consultantId] = n.consultantName;
          }
        });
        setDoctors(
          Object.entries(map).map(([id, name]) => ({ id, name }))
        );

        setLoading(false); // Set loading to false once data is fetched
      },
      err => {
        console.error("Tracker snapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ─── Fetch AI summary for one note ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedNote) return;
    (async () => {
      setNoteSummary("");
      setNoteSummaryLoading(true);
      if (SERVER_URL.includes("YOUR_SERVER_IP")) {
        console.warn("Set SERVER_URL first");
        setNoteSummaryLoading(false);
        return;
      }
      try {
        const resp = await fetch(`${SERVER_URL}/analyzeNotes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: [selectedNote] })
        });
        if (resp.ok) {
          const { summary } = await resp.json();
          setNoteSummary(summary || "");
        }
      } catch (e) {
        console.warn("AI error:", e.message);
      } finally {
        setNoteSummaryLoading(false);
      }
    })();
  }, [selectedNote]);

  // ─── Loading Indicator ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // ─── NOTE DETAIL SCREEN ───────────────────────────────────────────────────────
  if (selectedNote) {
  const n = selectedNote;
  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader title="Note Details" navigation={navigation} />

      {/* Back button */}
      <TouchableOpacity
        onPress={() => setSelectedNote(null)}
        style={styles.backButton}
      >
        <Text style={styles.backText}>← Back to notes</Text>
      </TouchableOpacity>

      {/* Header Card */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>{n.consultantName || "Unknown Doctor"}</Text>
        <Text style={styles.headerSubtitle}>
          {n.consultationType
            ? n.consultationType.charAt(0).toUpperCase() +
              n.consultationType.slice(1)
            : "Consultation"}
        </Text>
        <Text style={styles.headerDate}>
          {n.createdAt.toLocaleDateString()} at{" "}
          {n.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>

      {/* AI Insights Card */}
      {noteSummaryLoading ? (
        <ActivityIndicator
          style={styles.aiLoader}
          color={theme.colors.primary}
        />
      ) : noteSummary ? (
        <View style={styles.aiCard}>
          <Text style={styles.aiHeader}>✨ Insights by AI</Text>
          <Text style={styles.aiText}>{noteSummary}</Text>
        </View>
      ) : null}

      {/* ─── DETAIL SECTIONS ───────────────────────────────────── */}
      <ScrollView contentContainerStyle={styles.detailContainer}>
        {renderSection("🩺 Maternal Health", n.maternalHealth)}
        {renderSection("👶 Pregnancy Screening", n.screening)}
        {renderSection("❤️ Fetal Health", n.fetalHealth)}
        {renderSection("📊 Vital Signs", n.vitalSigns)}
        {renderSection("📈 Fetal Monitoring", n.fetalMonitoring)}
        {renderSection("🔬 Core Labs", n.labs)}
        {renderSection("🧪 Type & Screen", n.typeAndScreen)}
        {renderSection("🩸 Blood Cultures & Ultrasound", {
          "Blood Cultures Drawn": n.bloodCultures,
          "Ultrasound Findings": n.ultrasoundFindings,
        })}

        {/* Assessment + Recommendations */}
        {(() => {
          const t = n.consultationType || "unknown";
          const assessment = n[`${t}Assessment`] ?? n.assessment;
          const recommendations = n[`${t}Recommendations`] ?? n.recommendations;
          return (
            <>
              {assessment && (
                <View style={styles.assessmentCard}>
                  <Text style={styles.assessmentHeader}>📝 Assessment</Text>
                  <Text style={styles.assessmentText}>{assessment}</Text>
                </View>
              )}
              {recommendations && (
                <View style={styles.recommendCard}>
                  <Text style={styles.recommendHeader}>✅ Recommendations</Text>
                  <Text style={styles.recommendText}>{recommendations}</Text>
                </View>
              )}
            </>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

  // ─── NOTES LIST FOR A SELECTED DOCTOR (with filtering) ───────────────────────
  if (selectedDoctorId) {
    // all notes by this doctor
    const docNotes = notes.filter((n) => n.consultantId === selectedDoctorId);
    // then filter by type
    const filteredNotes =
      filterType === "all"
        ? docNotes
        : docNotes.filter((n) => n.consultationType === filterType);

    const docName = doctors.find((d) => d.id === selectedDoctorId)?.name;

    return (
      <SafeAreaView style={styles.container}>
        <CustomHeader title={`${docName}'s Notes`} navigation={navigation} />

        {/* ─── Filter buttons ─────────────────────────────────────── */}
        <View style={styles.filterContainer}>
          {["all", "pregnancy", "prenatal", "emergency"].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterButton,
                filterType === type && styles.filterButtonActive,
              ]}
              onPress={() => setFilterType(type)}
            >
              <Text
                style={[
                  styles.filterText,
                  filterType === type && styles.filterTextActive,
                ]}
              >
                {type === "all"
                  ? "All"
                  : type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => setSelectedDoctorId(null)}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back to doctors</Text>
        </TouchableOpacity>

        <FlatList
          data={filteredNotes}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No notes recorded by {docName}.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.noteCard}
              onPress={() => setSelectedNote(item)}
            >
              <Text style={styles.noteDate}>
                {item.createdAt.toLocaleDateString()}
              </Text>
              <Text style={styles.noteSnippet}>
                {(() => {
                  const t = item.consultationType || "unknown";
                  const a = item[`${t}Assessment`] ?? item.assessment;
                  return a?.slice(0, 60) || "Tap to view details";
                })()}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContainer}
        />
      </SafeAreaView>
    );
  }

  // ─── DOCTOR LIST SCREEN ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader title="Your Doctors" navigation={navigation} />
      <Text style={styles.hintText}>
        Select a doctor to see your past consultation notes.
      </Text>
      <FlatList
        data={doctors}
        keyExtractor={(d) => d.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No doctors have added notes yet.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.doctorCard}
            onPress={() => setSelectedDoctorId(item.id)}
          >
            <Text style={styles.doctorName}>{item.name}</Text>
            <Text style={styles.doctorSubtitle}>
              Tap to view notes
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

// ─── Helper functions ───────────────────────────────────────────────────────────
function humanize(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase());
}

function renderSection(title, dataObj) {
  if (!dataObj) return null;
  const entries = Object.entries(dataObj).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {entries.map(([key, value]) => (
        <View key={key} style={styles.detailCard}>
          <Text style={styles.detailLabel}>{humanize(key)}</Text>
          <Text style={styles.detailValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function renderRow(label, value) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}


// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background || "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Doctor list
  hintText: {
    textAlign: "center",
    marginHorizontal: 20,
    marginBottom: 14,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  doctorCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  doctorSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },

  // Notes list
  listContainer: { paddingBottom: 30 },
  noteCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  noteDate: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  noteSnippet: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },

  // Empty state
  emptyText: {
    textAlign: "center",
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: 40,
  },

  // Back button
  backButton: { margin: 16 },
  backText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: "600",
  },

  // AI Insights card
  aiLoader: { margin: 16 },
  aiCard: {
    backgroundColor: "#eef6ff",
    margin: 16,
    padding: 18,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primaryLight,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  aiHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primaryDark,
    marginBottom: 8,
  },
  aiText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },


  // Detail view
detailContainer: { 
  padding: 16,
},

detailCard: {
  backgroundColor: "#fff",
  padding: 14,
  marginBottom: 10,
  borderRadius: 10,
  shadowColor: "#000",
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 2,
  borderLeftWidth: 4,
  borderLeftColor: theme.colors.primary,
},

detailLabel: {
  fontSize: 15,
  fontWeight: "700",
  color: theme.colors.textSecondary,
  marginBottom: 4,
},

detailValue: {
  fontSize: 17,
  color: theme.colors.textPrimary,
  lineHeight: 22,
},


  // Filters
  filterContainer: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    margin: 6,
    backgroundColor: "#fff",
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  filterText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  filterTextActive: {
    color: "#fff",
  },

  // Section titles
  section: {
    marginVertical: 10,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 6,
    color: theme.colors.textPrimary,
  },
  // Header card
headerCard: {
  backgroundColor: "#fff",
  marginHorizontal: 16,
  marginTop: 10,
  marginBottom: 16,
  padding: 18,
  borderRadius: 12,
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
  alignItems: "center",
},
headerTitle: {
  fontSize: 20,
  fontWeight: "700",
  color: theme.colors.textPrimary,
},
headerSubtitle: {
  fontSize: 16,
  color: theme.colors.secondary,
  marginTop: 4,
},
headerDate: {
  fontSize: 13,
  color: theme.colors.textSecondary,
  marginTop: 6,
},

// Assessment & Recommendations
assessmentCard: {
  backgroundColor: "#fef9c3",
  margin: 16,
  padding: 16,
  borderRadius: 12,
  borderLeftWidth: 4,
  borderLeftColor: "#facc15",
},
assessmentHeader: {
  fontSize: 16,
  fontWeight: "700",
  color: "#854d0e",
  marginBottom: 6,
},
assessmentText: {
  fontSize: 15,
  color: "#713f12",
  lineHeight: 21,
},

recommendCard: {
  backgroundColor: "#dcfce7",
  marginHorizontal: 16,
  marginBottom: 20,
  padding: 16,
  borderRadius: 12,
  borderLeftWidth: 4,
  borderLeftColor: "#22c55e",
},
recommendHeader: {
  fontSize: 16,
  fontWeight: "700",
  color: "#166534",
  marginBottom: 6,
},
recommendText: {
  fontSize: 15,
  color: "#14532d",
  lineHeight: 21,
},

});
