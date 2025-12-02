import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { GiftedChat, Bubble, Send } from 'react-native-gifted-chat';
import Icon from 'react-native-vector-icons/Ionicons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import CustomHeader from './CustomHeader';

const BACKEND_URL = 'http://192.168.1.27:3000/chatbot';//change ip to your local machine's IP address
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// Format "2025-04-25" → "April 25, 2025 (Friday, Weekday)"
const formatWordDate = iso => {
  if (!iso) return 'Date to be determined';
  const [y,m,d] = iso.split('-').map(Number);
  const date = new Date(y, m-1, d);
  const wd   = WEEKDAYS[date.getDay()];
  const wk   = [0,6].includes(date.getDay()) ? 'Weekend' : 'Weekday';
  return `${MONTHS[m-1]} ${d}, ${y} (${wd}, ${wk})`;
};

// Get specialty icon
const getSpecialtyIcon = (code) => {
  const icons = {
    GENERAL_OB: '👶',
    MFM: '🏥',
    OBSTETRIC_ULTRASOUND: '🔬',
    FETAL_MEDICINE: '🧬',
    REI: '💉',
    GYN_ONCOLOGY: '🎗️'
  };
  return icons[code] || '👨‍⚕️';
};

// Get risk color
const getRiskColor = (level) => {
  if (level === 'high') return '#FF6B6B';
  if (level === 'moderate') return '#FFA500';
  return '#4CAF50';
};

export default function ChatBotScreen({ navigation }) {
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Initialize chat on mount with natural greeting
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
        
        // Add greeting message
        setMessages([{
          _id: 1,
          text: data.question || data.advice || 'Hello! How can I help you today?',
          createdAt: new Date(),
          user: { _id: 2, name: 'HealthBot', avatar: '🤖' }
        }]);
      } catch (e) {
        console.error('Chat init error:', e);
        setMessages([{
          _id: 1,
          text: "I'm having trouble connecting right now. Please check your internet connection and try again.",
          createdAt: new Date(),
          user: { _id: 2, name: 'HealthBot', avatar: '🤖' }
        }]);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const onSend = useCallback(async newMsgs => {
    const userMsg = newMsgs[0].text.trim();
    
    // Add user message immediately
    setMessages(prev => GiftedChat.append(prev, newMsgs));
    setIsTyping(true);
    setLoading(true);

    try {
      const resp = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMsg })
      });

      if (!resp.ok) {
        throw new Error(`Server error: ${resp.status}`);
      }

      const data = await resp.json();

      // Handle emergency/urgent responses
      if (data.urgent) {
        Alert.alert(
          '⚠️ Urgent',
          data.advice,
          [{ text: 'I Understand', style: 'default' }],
          { cancelable: false }
        );
      }

      // Build bot response text
      let botText = data.advice || '';
      if (data.question) {
        botText += (botText ? '\n\n' : '') + data.question;
      }

      // Add standard bot message if there's text
      if (botText) {
        setMessages(prev => GiftedChat.append(prev, [{
          _id: Math.random().toString(36).substr(2,9),
          text: botText,
          createdAt: new Date(),
          user: { _id: 2, name: 'HealthBot', avatar: '🤖' }
        }]));
      }

      // ========== NEW: Handle list of doctors ==========
      if (data.doctors && Array.isArray(data.doctors) && data.doctors.length > 0) {
        setMessages(prev => GiftedChat.append(prev, [{
          _id: Math.random().toString(36).substr(2,9),
          type: 'doctor_list',
          doctors: data.doctors,
          text: 'Available doctors',
          createdAt: new Date(),
          user: { _id: 2, name: 'HealthBot', avatar: '🤖' }
        }]));
      }

      // Handle booking action with subspecialty info
      if (data.action === 'book' && data.consultant) {
        setMessages(prev => GiftedChat.append(prev, [{
          _id: Math.random().toString(36).substr(2,9),
          type: 'booking',
          consultant: data.consultant,
          consultantId: data.consultantId,
          nextDate: data.nextDate,
          specialtyCode: data.specialtyCode,
          specialtyName: data.specialtyName,
          metadata: data.metadata,
          text: `Book appointment with Dr. ${data.consultant.name}`,
          createdAt: new Date(),
          user: { _id: 2, name: 'HealthBot', avatar: '🤖' }
        }]));
      }

      // Handle doctor recommendation (no provider case)
      if (data.doctorId && data.specialtyCode && !data.action) {
        setMessages(prev => GiftedChat.append(prev, [{
          _id: Math.random().toString(36).substr(2,9),
          type: 'recommendation',
          doctorId: data.doctorId,
          specialtyCode: data.specialtyCode,
          specialtyName: data.specialtyName,
          metadata: data.metadata,
          text: 'View specialist recommendation',
          createdAt: new Date(),
          user: { _id: 2, name: 'HealthBot', avatar: '🤖' }
        }]));
      }

    } catch (err) {
      console.error('Send message error:', err);
      setMessages(prev => GiftedChat.append(prev, [{
        _id: Math.random().toString(36).substr(2,9),
        text: `I apologize, but I'm having trouble processing your message. Please try again. ${err.message}`,
        createdAt: new Date(),
        user: { _id: 2, name: 'HealthBot', avatar: '🤖' }
      }]));
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  }, [sessionId]);

  // Navigate to consultant detail screen
  const navigateToConsultant = async (consultantId) => {
    try {
      setLoading(true);
      const docSnap = await getDoc(doc(db, 'consultants', consultantId));
      if (docSnap.exists()) {
        navigation.navigate('ConsultantDetail', {
          consultantId: consultantId
        });
      } else {
        Alert.alert('Error', 'Doctor information not found. Please try again.');
      }
    } catch (error) {
      console.error('Error navigating to consultant:', error);
      Alert.alert('Error', 'Unable to load doctor details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Custom view for booking cards and doctor lists
  const renderCustomView = (props) => {
    const m = props.currentMessage;

    // ========== NEW: Doctor List Card ==========
    if (m.type === 'doctor_list' && m.doctors) {
      return (
        <View style={styles.doctorListContainer}>
          <Text style={styles.doctorListTitle}>
            📋 Available Specialists ({m.doctors.length})
          </Text>
          <ScrollView 
            style={styles.doctorScrollView}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
          >
            {m.doctors.map((doctor, index) => (
              <TouchableOpacity
                key={doctor.id}
                style={styles.doctorListItem}
                onPress={() => navigateToConsultant(doctor.id)}
                activeOpacity={0.7}
              >
                <View style={styles.doctorListHeader}>
                  <Text style={styles.doctorListIcon}>
                    {getSpecialtyIcon(doctor.subspecialty)}
                  </Text>
                  <View style={styles.doctorListInfo}>
                    <Text style={styles.doctorListName}>
                      Dr. {doctor.name}
                    </Text>
                    <Text style={styles.doctorListSpecialty}>
                      {doctor.specialty}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={20} color="#007AFF" />
                </View>

                {/* Rating & Experience */}
                <View style={styles.doctorListDetails}>
                  {doctor.rating && (
                    <View style={styles.doctorListBadge}>
                      <Text style={styles.doctorListBadgeText}>
                        ⭐ {doctor.rating}/5
                      </Text>
                      {doctor.reviewCount && (
                        <Text style={styles.doctorListBadgeSubtext}>
                          ({doctor.reviewCount} reviews)
                        </Text>
                      )}
                    </View>
                  )}
                  {doctor.yearsOfExperience && (
                    <View style={styles.doctorListBadge}>
                      <Text style={styles.doctorListBadgeText}>
                        📅 {doctor.yearsOfExperience} years
                      </Text>
                    </View>
                  )}
                </View>

                {/* Next Available */}
                {doctor.nextAvailable && (
                  <View style={styles.doctorListFooter}>
                    <Text style={styles.doctorListAvailable}>
                      📆 Next: {formatWordDate(doctor.nextAvailable)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.doctorListFooterNote}>
            Tap any doctor to view full details
          </Text>
        </View>
      );
    }

    // Booking card with subspecialty info
    if (m.type === 'booking' && m.consultant) {
      return (
        <View style={styles.bookingCard}>
          {/* Specialty Header */}
          {m.specialtyCode && (
            <View style={styles.specialtyHeader}>
              <Text style={styles.specialtyIcon}>
                {getSpecialtyIcon(m.specialtyCode)}
              </Text>
              <View style={styles.specialtyInfo}>
                <Text style={styles.specialtyName}>{m.specialtyName}</Text>
                {m.metadata?.assessment?.risk_level && (
                  <View style={[
                    styles.riskBadge,
                    { backgroundColor: getRiskColor(m.metadata.assessment.risk_level) }
                  ]}>
                    <Text style={styles.riskText}>
                      {m.metadata.assessment.risk_level.toUpperCase()} RISK
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Doctor Info - CLICKABLE */}
          <TouchableOpacity
            style={styles.doctorSection}
            onPress={() => navigateToConsultant(m.consultantId)}
            activeOpacity={0.7}
          >
            <View style={styles.doctorNameRow}>
              <Text style={styles.doctorName}>Dr. {m.consultant.name}</Text>
              <Icon name="information-circle-outline" size={20} color="#007AFF" />
            </View>
            {m.consultant.subspecialty && (
              <Text style={styles.subspecialty}>
                🎯 {m.consultant.subspecialty}
              </Text>
            )}
            {m.nextDate && (
              <Text style={styles.dateText}>
                📅 {formatWordDate(m.nextDate)}
              </Text>
            )}
            {m.consultant.yearsOfExperience && (
              <Text style={styles.experience}>
                ⭐ {m.consultant.yearsOfExperience} years experience
              </Text>
            )}
            <Text style={styles.tapToViewText}>
              👆 Tap to view full profile
            </Text>
          </TouchableOpacity>

          {/* Assessment Details */}
          {m.metadata?.assessment?.key_concerns && m.metadata.assessment.key_concerns.length > 0 && (
            <View style={styles.concernsSection}>
              <Text style={styles.concernsTitle}>Key Concerns:</Text>
              {m.metadata.assessment.key_concerns.map((concern, idx) => (
                <Text key={idx} style={styles.concernItem}>• {concern}</Text>
              ))}
            </View>
          )}

          {/* Reasoning */}
          {m.metadata?.assessment?.reasoning && (
            <View style={styles.reasoningSection}>
              <Text style={styles.reasoningText}>
                💡 {m.metadata.assessment.reasoning}
              </Text>
            </View>
          )}

          {/* Book Button */}
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => {
              navigation.navigate('AppointmentScreen', {
                consultant: m.consultant,
                consultantId: m.consultantId,
                date: m.nextDate,
                time: null,
                platform: m.consultant.platform?.[0] || '',
                specialtyCode: m.specialtyCode,
                specialtyName: m.specialtyName,
                assessment: m.metadata?.assessment
              });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.bookButtonText}>Book Appointment</Text>
            <Icon name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>

          {/* Alternative Consultants */}
          {m.metadata?.alternativeConsultants?.length > 0 && (
            <TouchableOpacity
              style={styles.viewMoreButton}
              onPress={() => {
                Alert.alert(
                  'Alternative Specialists',
                  `${m.metadata.alternativeConsultants.length} more specialists available:\n\n${
                    m.metadata.alternativeConsultants.map(c => `• Dr. ${c.name}`).join('\n')
                  }`,
                  [{ text: 'OK' }]
                );
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.viewMoreText}>
                View {m.metadata.alternativeConsultants.length} more specialist{m.metadata.alternativeConsultants.length > 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Recommendation card (when doctor suggested but not booking yet)
    if (m.type === 'recommendation' && m.doctorId) {
      return (
        <View style={styles.recommendationCard}>
          {m.specialtyCode && (
            <View style={styles.specialtyHeader}>
              <Text style={styles.specialtyIcon}>
                {getSpecialtyIcon(m.specialtyCode)}
              </Text>
              <View style={styles.specialtyInfo}>
                <Text style={styles.specialtyName}>{m.specialtyName}</Text>
                {m.metadata?.assessment?.risk_level && (
                  <View style={[
                    styles.riskBadge,
                    { backgroundColor: getRiskColor(m.metadata.assessment.risk_level) }
                  ]}>
                    <Text style={styles.riskText}>
                      {m.metadata.assessment.risk_level.toUpperCase()} RISK
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {m.metadata?.assessment?.key_concerns && m.metadata.assessment.key_concerns.length > 0 && (
            <View style={styles.concernsSection}>
              <Text style={styles.concernsTitle}>Recommended for:</Text>
              {m.metadata.assessment.key_concerns.map((concern, idx) => (
                <Text key={idx} style={styles.concernItem}>• {concern}</Text>
              ))}
            </View>
          )}

          {m.metadata?.assessment?.reasoning && (
            <View style={styles.reasoningSection}>
              <Text style={styles.reasoningText}>
                💡 {m.metadata.assessment.reasoning}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.viewDoctorButton}
            onPress={() => navigateToConsultant(m.doctorId)}
            activeOpacity={0.8}
          >
            <Text style={styles.viewDoctorText}>View Doctor Details</Text>
            <Icon name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <CustomHeader 
        title="Chat with HealthBot" 
        onBack={() => navigation.goBack()} 
      />
      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{ _id: 1 }}
        renderBubble={props => (
          <Bubble
            {...props}
            wrapperStyle={{
              right: { 
                backgroundColor: '#007AFF',
                borderRadius: 20,
                borderBottomRightRadius: 4,
              },
              left: { 
                backgroundColor: '#ECECEC',
                borderRadius: 20,
                borderBottomLeftRadius: 4,
              },
            }}
            textStyle={{
              right: { color: '#fff', fontSize: 15 },
              left: { color: '#000', fontSize: 15 },
            }}
          />
        )}
        renderSend={props => (
          <Send {...props} disabled={loading}>
            <View style={styles.sendButton}>
              <Icon 
                name="send" 
                size={24} 
                color={loading ? '#ccc' : '#007AFF'} 
              />
            </View>
          </Send>
        )}
        renderFooter={() => 
          isTyping && (
            <View style={styles.typingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.typingText}>HealthBot is typing...</Text>
            </View>
          )
        }
        renderCustomView={renderCustomView}
        scrollToBottom
        scrollToBottomComponent={() => (
          <Icon name="chevron-down-circle" size={32} color="#007AFF" />
        )}
        placeholder="Type your message..."
        alwaysShowSend
        keyboardShouldPersistTaps="never"
        renderAvatarOnTop={false}
        showUserAvatar={false}
        inverted={true}
        minInputToolbarHeight={60}
        textInputProps={{
          autoCapitalize: 'sentences',
          autoCorrect: true,
          multiline: true,
          maxLength: 500,
        }}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f8f8' 
  },
  
  sendButton: {
    marginRight: 12,
    marginBottom: 8,
  },

  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
  },

  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ========== Doctor List Styles (NEW) ==========
  doctorListContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 10,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    maxHeight: 500,
  },
  doctorListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  doctorScrollView: {
    maxHeight: 400,
  },
  doctorListItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  doctorListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  doctorListIcon: {
    fontSize: 28,
    marginRight: 10,
  },
  doctorListInfo: {
    flex: 1,
  },
  doctorListName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  doctorListSpecialty: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  doctorListDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  doctorListBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorListBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  doctorListBadgeSubtext: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  doctorListFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 8,
    marginTop: 4,
  },
  doctorListAvailable: {
    fontSize: 12,
    color: '#28A745',
    fontWeight: '600',
  },
  doctorListFooterNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },

  // ========== Booking Card Styles ==========
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 10,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },

  specialtyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  specialtyIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  specialtyInfo: {
    flex: 1,
  },
  specialtyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  riskText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  doctorSection: {
    marginBottom: 12,
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  doctorNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  subspecialty: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  experience: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },
  tapToViewText: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
    marginTop: 4,
  },

  concernsSection: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  concernsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  concernItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },

  reasoningSection: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  reasoningText: {
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 18,
  },

  bookButton: {
    backgroundColor: '#28A745',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#28A745',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bookButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 8,
  },

  viewMoreButton: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 4,
  },
  viewMoreText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // ========== Recommendation Card Styles ==========
  recommendationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 10,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
  },

  viewDoctorButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  viewDoctorText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});