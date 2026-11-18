Pod::Spec.new do |s|
  s.name           = 'GoalVideoEncoder'
  s.version        = '1.0.0'
  s.summary        = 'Goal videos to MP4 (Android only for now; the iPhone says not yet).'
  s.description    = 'Goal videos to MP4 (Android only for now; the iPhone says not yet).'
  s.license        = 'UNLICENSED'
  s.author         = 'Knowitball'
  s.homepage       = 'https://knowitball.co.uk'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = "**/*.{h,m,swift}"
end
