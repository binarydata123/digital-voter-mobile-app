import { StyleSheet, View } from 'react-native';

export function PoliticianListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading politicians" accessibilityState={{ busy: true }} style={styles.list}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.card}>
          <View style={[styles.block, styles.avatar]} />
          <View style={styles.text}>
            <View style={[styles.block, styles.name]} />
            <View style={[styles.block, styles.party]} />
          </View>
          <View style={[styles.block, styles.action]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DFE8E4', borderRadius: 14 },
  block: { backgroundColor: '#E4EFEB' },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  text: { flex: 1, gap: 10 },
  name: { height: 15, width: '75%', borderRadius: 5 },
  party: { height: 12, width: '45%', borderRadius: 4 },
  action: { width: 14, height: 20, borderRadius: 4 },
});
