import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { GiftedChat, Bubble, Send } from 'react-native-gifted-chat';
import Icon from 'react-native-vector-icons/Ionicons';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import CustomHeader from './CustomHeader';

const BACKEND_URL = 'http://172.16.201.190:3000/chatbot';
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS   = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
// Build a regex pattern for month names
const MONTH_NAMES_PATTERN = MONTHS.map(m => m.toLowerCase()).join('|');

// Format "2025-04-25" → "April 25, 2025 (Friday, Weekday)"
const formatWordDate = iso => {
  const [y,m,d] = iso.split('-').map(Number);
  const date = new Date(y, m-1, d);
  const wd   = WEEKDAYS[date.getDay()];
  const wk   = [0,6].includes(date.getDay()) ? 'Weekend' : 'Weekday';
  return `${MONTHS[m-1]} ${d}, ${y} (${wd}, ${wk})`;
};

// Normalize strings for matching
const normalize = s =>
  String(s || '')
    .replace(/^dr\.?\s*/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

// Fetch consultant by ID
const getConsultantById = async id => {
  const snap = await getDoc(doc(db, 'consultants', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// List upcoming ISO dates matching available weekdays
const upcomingDates = (wdList, span = 30) => {
  const out = [];
  const today = new Date();
  for (let i = 0; i < span; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    if (wdList.map(w=>w.toLowerCase())
        .includes(WEEKDAYS[d.getDay()].toLowerCase())) {
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      out.push(iso);
    }
  }
  return out;
};

// Parse "today", "tomorrow", "this Monday", "2025-04-25", "May 8", etc.
const parseDateTime = text => {
  const t = String(text || '').trim();
  const lower = t.toLowerCase();
  const today = new Date();

  // 1) Today
  if (/\btoday\b/.test(lower)) {
    return { date: formatISO(today), time: null };
  }
  // 2) Tomorrow / next day
  if (/\btomorrow\b/.test(lower) || /\bnext day\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return { date: formatISO(d), time: null };
  }
  // 3) This/next <weekday>
  let m = lower.match(/\b(this|next)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (m) {
    const which = m[1], dayName = m[2];
    const idx = WEEKDAYS.indexOf(capitalize(dayName));
    let d = new Date(today);
    let delta = (idx - d.getDay() + 7) % 7;
    if (which === 'next' && delta === 0) delta = 7;
    d.setDate(d.getDate() + delta);
    return { date: formatISO(d), time: null };
  }
  // 4) Month Day [Year]?  (e.g. May 8, 2025 or May 8th)
  const monthDayRegex = new RegExp(`\\b(${MONTH_NAMES_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`, 'i');
  const md = monthDayRegex.exec(t);
  if (md) {
    const monthName = md[1].toLowerCase();
    const day = parseInt(md[2], 10);
    const year = md[3] ? parseInt(md[3], 10) : today.getFullYear();
    const mIndex = MONTHS.map(m=>m.toLowerCase()).indexOf(monthName);
    if (mIndex >= 0) {
      const d = new Date(year, mIndex, day);
      if (!isNaN(d)) {
        return { date: formatISO(d), time: null };
      }
    }
  }
  // 5) ISO format YYYY-MM-DD
  m = lower.match(/(\d{4}-\d{2}-\d{2})/);
  const date = m ? m[1] : null;
  // 6) Time only
  const tm = t.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  return { date, time: tm ? tm[1] : null };
};

// Helper to zero-pad and extract ISO date
const formatISO = d => {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth()+1).padStart(2,'0');
  const dd   = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
};
const capitalize = str => str[0].toUpperCase() + str.slice(1);

// Parse times like "8 PM" or "14:30" → "H:MM AM/PM"
const parseUserTime = input => {
  const m = String(input || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10), mm = m[2] ? parseInt(m[2], 10) : 0;
  let suffix = m[3] ? m[3].toUpperCase() : (h >= 12 ? 'PM' : 'AM');
  if (suffix === 'PM' && h < 12) h += 12;
  if (suffix === 'AM' && h === 12) h = 0;
  const dispH = h % 12 === 0 ? 12 : h % 12;
  const dispM = String(mm).padStart(2, '0');
  return `${dispH}:${dispM} ${suffix}`;
};

export default function ChatBotScreen({ navigation }) {
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [stage, setStage]       = useState('bot');
  const [doctor, setDoctor]     = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [chosenDate, setChosenDate] = useState(null);
  const [chosenTime, setChosenTime] = useState(null);
  const [chosenPlatform, setChosenPlatform] = useState(null);

  // ————— On mount: hit the server once to grab the very first question —————
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch(BACKEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: 'hi' })
        });
        const data = await resp.json();
        setMessages([{
          _id: 1,
          text: data.question || data.advice,
          createdAt: new Date(),
          user: { _id: 2, name: 'HealthBot' }
        }]);
      } catch (e) {
        setMessages([{
          _id: 1,
          text: `Error starting chat: ${e.message}`,
          createdAt: new Date(),
          user: { _id: 2, name: 'HealthBot' }
        }]);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const resetConversation = () => {
    setStage('bot');
    setDoctor(null);
    setAvailableDates([]);
    setChosenDate(null);
    setChosenTime(null);
    setChosenPlatform(null);
    setMessages([]);  // if you want to clear the chat
    // optionally rerun the useEffect logic by bumping a key or reloading the screen
  };

  const onSend = useCallback(async newMsgs => {
    const userMsg = newMsgs[0].text.trim();
    setMessages(prev => GiftedChat.append(prev, newMsgs));
    setLoading(true);

    try {
      const resp = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMsg })
      });
      const data = await resp.json();

      // append standard bot text
      let botText = data.advice || '';
      if (data.question) {
        botText += (botText ? '\n\n' : '') + data.question;
      }

      setMessages(prev => GiftedChat.append(prev, [{
        _id: Math.random().toString(36).substr(2,9),
        text: botText,
        createdAt: new Date(),
        user: { _id: 2, name: 'HealthBot' }
      }]));

      // if server flagged a booking action, insert a special "booking" message
      if (data.action === 'book' && data.consultant) {
        setMessages(prev => GiftedChat.append(prev, [{
          _id: Math.random().toString(36).substr(2,9),
          type: 'booking',
          consultant: data.consultant,
          nextDate: data.nextDate,       // ISO string
          text: `Book with Dr. ${data.consultant.name} on ${formatWordDate(data.nextDate)}`,
          createdAt: new Date(),
          user: { _id: 2, name: 'HealthBot' }
        }]));
      }
    } catch (err) {
      setMessages(prev => GiftedChat.append(prev, [{
        _id: Math.random().toString(36).substr(2,9),
        text: `Error: ${err.message}`,
        createdAt: new Date(),
        user: { _id: 2, name: 'HealthBot' }
      }]));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return (
    <View style={styles.container}>
      <CustomHeader title="Chat with HealthBot" onBack={() => navigation.goBack()} />
      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{ _id: 1 }}
        renderBubble={props => (
          <Bubble
            {...props}
            wrapperStyle={{
              right: { backgroundColor: '#007AFF' },
              left:  { backgroundColor: '#ECECEC' },
            }}
            textStyle={{
              right: { color: '#fff' },
              left:  { color: '#000' },
            }}
          />
        )}
        renderSend={props => (
          <Send {...props}>
            <Icon name="send" size={24} style={{ margin: 8 }} />
          </Send>
        )}
        renderFooter={() => loading && <ActivityIndicator style={styles.spinner} size="small" />}
        scrollToBottom
        renderCustomView={props => {
          const m = props.currentMessage;
          if (m.type === 'booking' && m.consultant) {
            return (
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() =>
                  navigation.navigate('AppointmentScreen', {
                    consultant: m.consultant,
                    date:       m.nextDate,
                    time:       null,
                    platform:   m.consultant.platform?.[0] || ''
                  })
                }
              >
                <Text style={styles.confirmText}>Book Appointment</Text>
              </TouchableOpacity>
            );
          }
          return null;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  spinner:   { marginVertical: 10 },
  confirmBtn:  { backgroundColor: '#28A745', padding: 10, borderRadius: 6, alignSelf: 'flex-start', marginVertical: 6 },
  confirmText: { color: '#fff', fontWeight: '600' },
});