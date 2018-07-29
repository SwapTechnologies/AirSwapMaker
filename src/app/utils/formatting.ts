export const pad = (n, width, z) => {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};

export const removeLeadingZeros = (data) => {
  let cleaned_string = data.replace(/0x0*/, '0x');
  while (cleaned_string.length < 42) {
    cleaned_string = cleaned_string.replace('0x', '0x0');
  }
  return cleaned_string;
};
