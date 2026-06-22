import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

interface SignaturePadProps {
  onChange: (data: string) => void;
  height?: number;
}

export function SignaturePad({ onChange, height = 180 }: SignaturePadProps) {
  const colors = useColors();
  const [paths, setPaths] = useState<string[]>([]);
  const current = useRef<string>('');

  const emit = (all: string[]) => onChange(all.join(' '));

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        current.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        current.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setPaths(prev => {
          const next = [...prev];
          next[next.length - 1] = current.current;
          return next;
        });
      },
      onPanResponderStart: () => {
        setPaths(prev => [...prev, current.current]);
      },
      onPanResponderRelease: () => {
        setPaths(prev => {
          emit(prev);
          return prev;
        });
      },
    })
  ).current;

  const clear = () => {
    current.current = '';
    setPaths([]);
    onChange('');
  };

  return (
    <View style={{ gap: 8 }}>
      <View
        style={[styles.pad, { height, borderColor: colors.border, backgroundColor: colors.card }]}
        {...responder.panHandlers}
      >
        <Svg width="100%" height="100%">
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke={colors.foreground} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
        {paths.length === 0 && (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Sign here</Text>
        )}
      </View>
      <TouchableOpacity onPress={clear} style={[styles.clearBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
        <Text style={[styles.clearText, { color: colors.mutedForeground }]}>Clear Signature</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { borderWidth: 1, borderRadius: 12, borderStyle: 'dashed', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', fontSize: 14, fontFamily: 'Inter_400Regular' },
  clearBtn: { alignSelf: 'flex-end', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  clearText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
