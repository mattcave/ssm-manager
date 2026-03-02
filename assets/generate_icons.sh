mkdir icon.iconset
sips -z 16 16     augmentt_ssm_icon_512.png --out icon.iconset/icon_16x16.png
sips -z 32 32     augmentt_ssm_icon_512.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     augmentt_ssm_icon_512.png --out icon.iconset/icon_32x32.png
sips -z 64 64     augmentt_ssm_icon_512.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   augmentt_ssm_icon_512.png --out icon.iconset/icon_128x128.png
sips -z 256 256   augmentt_ssm_icon_512.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   augmentt_ssm_icon_512.png --out icon.iconset/icon_256x256.png
sips -z 512 512   augmentt_ssm_icon_512.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   augmentt_ssm_icon_512.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 augmentt_ssm_icon_512.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset