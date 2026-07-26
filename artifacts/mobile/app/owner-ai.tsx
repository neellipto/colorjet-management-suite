import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useErpRuntime } from '@/context/ErpRuntimeContext';
import {
  askOwnerAi,
  confirmAiAction,
  previewAiAction,
  rejectAiAction,
  type AiActionPreview,
  type AiDraftAction,
  type AiResponse,
} from '@/lib/ownerAi';
import { useColors } from '@/hooks/useColors';

function DraftActionCard({
  action,
  onPreview,
}: {
  action: AiDraftAction;
  onPreview: (action: AiDraftAction) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.actionTitleRow}>
        <Text style={[styles.actionTitle, { color: colors.foreground }]}>{action.title}</Text>
        <Text style={[styles.risk, { color: action.riskLevel === 'critical' ? colors.destructive : colors.secondary }]}>{action.riskLevel.toUpperCase()}</Text>
      </View>
      <Text style={[styles.actionSummary, { color: colors.mutedForeground }]}>{action.summary}</Text>
      <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.primary }]} onPress={() => onPreview(action)}>
        <Feather name="eye" size={15} color={colors.primary} />
        <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Preview action</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function OwnerAiScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { authenticated, permissions } = useErpRuntime();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [preview, setPreview] = useState<AiActionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed = Boolean(authenticated && permissions?.isOwner);
  const canSubmit = useMemo(() => allowed && prompt.trim().length >= 3 && !loading, [allowed, prompt, loading]);

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      setResponse(await askOwnerAi({ prompt: prompt.trim(), mode: 'analysis', language: 'bilingual' }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Owner AI request failed.');
    } finally {
      setLoading(false);
    }
  };

  const openPreview = async (action: AiDraftAction) => {
    setActionBusy(true);
    setError(null);
    try {
      setPreview(await previewAiAction(action.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to preview AI action.');
    } finally {
      setActionBusy(false);
    }
  };

  const execute = async () => {
    if (!preview) return;
    Alert.alert(
      'Confirm protected action',
      preview.action.confirmationText || 'Execute this AI-drafted action?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Execute',
          style: 'destructive',
          onPress: async () => {
            setActionBusy(true);
            try {
              const result = await confirmAiAction({
                approvalId: preview.approvalId,
                confirmationText: preview.action.confirmationText || 'CONFIRM',
              });
              setPreview(null);
              Alert.alert('Action recorded', `Audit reference: ${result.auditReference}`);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : 'AI action execution failed.');
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
    );
  };

  const reject = async () => {
    if (!preview) return;
    setActionBusy(true);
    try {
      await rejectAiAction(preview.approvalId, 'Rejected by Owner from mobile preview.');
      setPreview(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to reject AI action.');
    } finally {
      setActionBusy(false);
    }
  };

  if (!allowed) {
    return (
      <View style={[styles.locked, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Feather name="shield" size={36} color={colors.mutedForeground} />
        <Text style={[styles.lockedTitle, { color: colors.foreground }]}>Owner AI is restricted</Text>
        <Text style={[styles.lockedText, { color: colors.mutedForeground }]}>Full company analysis and protected action execution require a server-confirmed OWNER permission.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28, paddingHorizontal: 16, gap: 14 }}
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>OWNER ONLY</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>COLORJET AI Command Center</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Analysis → Draft → Preview → Confirmation → Execute → Audit</Text>
      </View>

      <View style={[styles.promptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Ask about sales, collection, stock, service, risks or request a draft action…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[styles.input, { color: colors.foreground }]}
          textAlignVertical="top"
        />
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: canSubmit ? colors.primary : colors.muted }]}
          disabled={!canSubmit}
          onPress={() => void submit()}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
          <Text style={styles.primaryButtonText}>Analyse</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={[styles.errorBox, { borderColor: colors.destructive, backgroundColor: colors.card }]}>
          <Text style={{ color: colors.destructive }}>{error}</Text>
        </View>
      )}

      {response && (
        <View style={[styles.answerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>AI response</Text>
          <Text style={[styles.answer, { color: colors.foreground }]}>{response.answer}</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>{response.sources.length} authorised source(s) • {response.generatedAt}</Text>
        </View>
      )}

      {(response?.draftActions ?? []).map(action => (
        <DraftActionCard key={action.id} action={action} onPreview={item => void openPreview(item)} />
      ))}

      {preview && (
        <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.secondary }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Protected action preview</Text>
          <Text style={[styles.actionTitle, { color: colors.foreground }]}>{preview.action.title}</Text>
          <Text style={[styles.actionSummary, { color: colors.mutedForeground }]}>{preview.action.summary}</Text>
          {preview.warnings.map((warning, index) => (
            <View key={`${warning}-${index}`} style={styles.warningRow}>
              <Feather name="alert-triangle" size={15} color={colors.secondary} />
              <Text style={[styles.warningText, { color: colors.foreground }]}>{warning}</Text>
            </View>
          ))}
          <View style={styles.previewActions}>
            <TouchableOpacity style={[styles.rejectButton, { borderColor: colors.destructive }]} onPress={() => void reject()} disabled={actionBusy}>
              <Text style={{ color: colors.destructive, fontFamily: 'Inter_600SemiBold' }}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.executeButton, { backgroundColor: colors.primary }]} onPress={() => void execute()} disabled={actionBusy}>
              {actionBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Confirm & execute</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  lockedTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  lockedText: { fontSize: 14, lineHeight: 21, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  eyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  title: { fontSize: 23, fontFamily: 'Inter_700Bold', marginTop: 3 },
  subtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  promptCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  input: { minHeight: 118, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular' },
  primaryButton: { minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButtonText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  errorBox: { borderWidth: 1, borderRadius: 10, padding: 12 },
  answerCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 9 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  answer: { fontSize: 14, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  meta: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  actionCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  actionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  actionTitle: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold' },
  risk: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  actionSummary: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular' },
  secondaryButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  secondaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  previewCard: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 10 },
  warningRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  warningText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  previewActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectButton: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  executeButton: { flex: 2, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
