import React from "react";
import { View, Text } from "react-native";

function Unsupported(props) {
  return (
    <View style={[{ alignItems: "center", justifyContent: "center", padding: 16 }, props.style]}>
      <Text>Peta tidak didukung di web.</Text>
    </View>
  );
}

export default Unsupported;
export const Marker = Unsupported;
export const Callout = Unsupported;
export const Polygon = Unsupported;
export const Polyline = Unsupported;
export const Circle = Unsupported;
export const PROVIDER_GOOGLE = "google";
