# 📱 Guia para Criar um App de TV - React Native / Flutter

Este guia mostra como criar um aplicativo de TV similar ao Free TV para dispositivos móveis.

---

## Índice

1. [Escolha da Tecnologia](#escolha-da-tecnologia)
2. [React Native](#react-native)
3. [Flutter](#flutter)
4. [Estrutura do Projeto](#estrutura-do-projeto)
5. [Componentes Principais](#componentes-principais)
6. [Backend Necessário](#backend-necessário)

---

## Escolha da Tecnologia

### React Native

**Prós:**
- Compartilha conhecimento com React Web
- Grande comunidade
- Muitas bibliotecas disponíveis
- Hot reload rápido

**Contras:**
- Performance pode ser inferior ao nativo
- Algumas funcionalidades requerem código nativo

### Flutter

**Prós:**
- Performance excelente
- UI consistente iOS/Android
- Dart é fácil de aprender
- Suporte a TV (Android TV, Fire TV)

**Contras:**
- Comunidade menor que React Native
- Tamanho do app maior

---

## React Native

### Setup Inicial

```bash
# Criar projeto
npx react-native init FreeTV

# ou com Expo
npx create-expo-app FreeTV

# Instalar dependências principais
npm install react-native-video @react-navigation/native 
npm install react-native-fast-image @react-native-async-storage/async-storage
npm install react-native-linear-gradient react-native-google-cast
```

### Estrutura de Pastas

```
src/
├── App.tsx
├── navigation/
│   └── AppNavigator.tsx
├── screens/
│   ├── HomeScreen.tsx
│   ├── PlayerScreen.tsx
│   ├── GuideScreen.tsx
│   └── SettingsScreen.tsx
├── components/
│   ├── ChannelList.tsx
│   ├── ChannelCard.tsx
│   ├── VideoPlayer.tsx
│   ├── ProgramInfo.tsx
│   └── CategoryTabs.tsx
├── services/
│   ├── api.ts
│   ├── channelService.ts
│   └── epgService.ts
├── hooks/
│   ├── useChannels.ts
│   ├── useFavorites.ts
│   └── useEPG.ts
├── types/
│   └── index.ts
├── utils/
│   └── storage.ts
└── constants/
    └── colors.ts
```

### Tipos

```typescript
// src/types/index.ts

export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  category?: string;
  channelNumber?: number;
}

export interface Program {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  category?: string;
}

export interface CurrentProgram {
  current: Program | null;
  next: Program | null;
  progress: number;
}
```

### Componente de Player

```tsx
// src/components/VideoPlayer.tsx

import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Video, { OnLoadData, OnProgressData } from 'react-native-video';
import { Channel } from '../types';

interface Props {
  channel: Channel;
  onBack?: () => void;
}

export const VideoPlayer: React.FC<Props> = ({ channel, onBack }) => {
  const videoRef = useRef<Video>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const handleLoad = (data: OnLoadData) => {
    setIsLoading(false);
    console.log('Video loaded:', data.duration);
  };

  const handleError = (err: any) => {
    setIsLoading(false);
    setError('Erro ao carregar o canal');
    console.error('Video error:', err);
  };

  const handleProgress = (data: OnProgressData) => {
    // Live stream - não precisa de progress
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ 
          uri: channel.url,
          type: 'm3u8',  // HLS
        }}
        style={styles.video}
        resizeMode="contain"
        paused={isPaused}
        onLoad={handleLoad}
        onError={handleError}
        onProgress={handleProgress}
        onBuffer={({ isBuffering }) => setIsLoading(isBuffering)}
        
        // iOS specific
        allowsExternalPlayback={true}
        pictureInPicture={true}
        
        // Android specific
        useTextureView={true}
      />

      {/* Loading */}
      {isLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Carregando {channel.name}...</Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setIsLoading(true);
              videoRef.current?.seek(0);
            }}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Controls */}
      {showControls && (
        <View style={styles.controls}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          
          <View style={styles.channelInfo}>
            <Text style={styles.channelName}>{channel.name}</Text>
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>AO VIVO</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    color: '#fff',
    fontSize: 24,
  },
  channelInfo: {
    flex: 1,
    marginLeft: 16,
  },
  channelName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  liveBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
```

### Lista de Canais

```tsx
// src/components/ChannelList.tsx

import React from 'react';
import { FlatList, StyleSheet, View, Text } from 'react-native';
import { Channel } from '../types';
import { ChannelCard } from './ChannelCard';

interface Props {
  channels: Channel[];
  favorites: string[];
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
}

export const ChannelList: React.FC<Props> = ({
  channels,
  favorites,
  onSelectChannel,
  onToggleFavorite,
}) => {
  // Agrupa por categoria
  const groupedChannels = channels.reduce((acc, channel) => {
    const category = channel.category || 'Outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(channel);
    return acc;
  }, {} as Record<string, Channel[]>);

  const sections = Object.entries(groupedChannels).map(([category, items]) => ({
    category,
    data: items,
  }));

  return (
    <FlatList
      data={sections}
      keyExtractor={(item) => item.category}
      renderItem={({ item: section }) => (
        <View style={styles.section}>
          <Text style={styles.categoryTitle}>{section.category}</Text>
          <FlatList
            horizontal
            data={section.data}
            keyExtractor={(channel) => channel.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: channel }) => (
              <ChannelCard
                channel={channel}
                isFavorite={favorites.includes(channel.id)}
                onPress={() => onSelectChannel(channel)}
                onToggleFavorite={() => onToggleFavorite(channel.id)}
              />
            )}
          />
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  categoryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    marginLeft: 16,
  },
});
```

### Card de Canal

```tsx
// src/components/ChannelCard.tsx

import React, { useState } from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import { Channel } from '../types';

interface Props {
  channel: Channel;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}

export const ChannelCard: React.FC<Props> = ({
  channel,
  isFavorite,
  onPress,
  onToggleFavorite,
}) => {
  const [imageError, setImageError] = useState(false);
  
  const initials = channel.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.logoContainer}>
        {channel.logo && !imageError ? (
          <FastImage
            source={{ uri: channel.logo }}
            style={styles.logo}
            onError={() => setImageError(true)}
            resizeMode={FastImage.resizeMode.contain}
          />
        ) : (
          <View style={styles.initialsContainer}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.name} numberOfLines={1}>
        {channel.name}
      </Text>
      
      <TouchableOpacity 
        style={styles.favoriteButton}
        onPress={onToggleFavorite}
      >
        <Text style={styles.favoriteIcon}>
          {isFavorite ? '★' : '☆'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 120,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  initialsContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  name: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 4,
  },
  favoriteIcon: {
    color: '#fbbf24',
    fontSize: 16,
  },
});
```

### Hook de Favoritos

```typescript
// src/hooks/useFavorites.ts

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'tv-favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Erro ao carregar favoritos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = useCallback(async (channelId: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId];
      
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const isFavorite = useCallback((channelId: string) => {
    return favorites.includes(channelId);
  }, [favorites]);

  return { favorites, toggleFavorite, isFavorite, isLoading };
}
```

### Serviço de API

```typescript
// src/services/api.ts

const API_BASE = 'https://sua-api.com/api';

export async function fetchChannels(): Promise<Channel[]> {
  const response = await fetch(`${API_BASE}/channels`);
  if (!response.ok) throw new Error('Erro ao buscar canais');
  return response.json();
}

export async function fetchEPG(channelId: string): Promise<Program[]> {
  const response = await fetch(`${API_BASE}/epg/${channelId}`);
  if (!response.ok) throw new Error('Erro ao buscar EPG');
  return response.json();
}

export async function fetchCurrentProgram(channelId: string): Promise<CurrentProgram | null> {
  const response = await fetch(`${API_BASE}/epg/${channelId}/current`);
  if (!response.ok) return null;
  return response.json();
}
```

### Cast (Google Cast)

```typescript
// src/services/castService.ts

import GoogleCast, { CastButton } from 'react-native-google-cast';

export function initCast() {
  GoogleCast.showIntroductoryOverlay();
}

export async function castToDevice(channel: Channel) {
  const client = await GoogleCast.getClient();
  
  await client.loadMedia({
    mediaInfo: {
      contentUrl: channel.url,
      contentType: 'application/x-mpegurl',
      streamType: 'LIVE',
      metadata: {
        type: 'generic',
        title: channel.name,
        images: channel.logo ? [{ url: channel.logo }] : [],
      },
    },
  });
}

export function stopCast() {
  GoogleCast.endSession();
}
```

---

## Flutter

### Setup Inicial

```bash
# Criar projeto
flutter create free_tv

# Adicionar dependências no pubspec.yaml
dependencies:
  video_player: ^2.8.1
  chewie: ^1.7.1
  provider: ^6.1.1
  shared_preferences: ^2.2.2
  cached_network_image: ^3.3.0
  http: ^1.1.2
```

### Estrutura de Pastas

```
lib/
├── main.dart
├── app.dart
├── models/
│   ├── channel.dart
│   └── program.dart
├── screens/
│   ├── home_screen.dart
│   ├── player_screen.dart
│   └── guide_screen.dart
├── widgets/
│   ├── channel_card.dart
│   ├── channel_list.dart
│   └── video_player.dart
├── services/
│   ├── api_service.dart
│   └── storage_service.dart
├── providers/
│   ├── channels_provider.dart
│   └── favorites_provider.dart
└── utils/
    └── constants.dart
```

### Modelos

```dart
// lib/models/channel.dart

class Channel {
  final String id;
  final String name;
  final String url;
  final String? logo;
  final String? category;
  final int? channelNumber;

  Channel({
    required this.id,
    required this.name,
    required this.url,
    this.logo,
    this.category,
    this.channelNumber,
  });

  factory Channel.fromJson(Map<String, dynamic> json) {
    return Channel(
      id: json['id'],
      name: json['name'],
      url: json['url'],
      logo: json['logo'],
      category: json['category'],
      channelNumber: json['channelNumber'],
    );
  }
}
```

```dart
// lib/models/program.dart

class Program {
  final String id;
  final String title;
  final String? description;
  final DateTime startTime;
  final DateTime endTime;
  final String? category;

  Program({
    required this.id,
    required this.title,
    this.description,
    required this.startTime,
    required this.endTime,
    this.category,
  });

  factory Program.fromJson(Map<String, dynamic> json) {
    return Program(
      id: json['id'],
      title: json['title'],
      description: json['description'],
      startTime: DateTime.parse(json['startTime']),
      endTime: DateTime.parse(json['endTime']),
      category: json['category'],
    );
  }

  double get progress {
    final now = DateTime.now();
    if (now.isBefore(startTime)) return 0;
    if (now.isAfter(endTime)) return 100;
    
    final total = endTime.difference(startTime).inSeconds;
    final elapsed = now.difference(startTime).inSeconds;
    return (elapsed / total) * 100;
  }
}
```

### Video Player Widget

```dart
// lib/widgets/video_player.dart

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import '../models/channel.dart';

class TVVideoPlayer extends StatefulWidget {
  final Channel channel;
  final VoidCallback? onBack;

  const TVVideoPlayer({
    Key? key,
    required this.channel,
    this.onBack,
  }) : super(key: key);

  @override
  State<TVVideoPlayer> createState() => _TVVideoPlayerState();
}

class _TVVideoPlayerState extends State<TVVideoPlayer> {
  late VideoPlayerController _videoController;
  ChewieController? _chewieController;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _initPlayer();
  }

  Future<void> _initPlayer() async {
    _videoController = VideoPlayerController.networkUrl(
      Uri.parse(widget.channel.url),
      videoPlayerOptions: VideoPlayerOptions(
        mixWithOthers: true,
      ),
    );

    try {
      await _videoController.initialize();
      
      _chewieController = ChewieController(
        videoPlayerController: _videoController,
        autoPlay: true,
        looping: false,
        isLive: true,
        allowFullScreen: true,
        allowMuting: true,
        showControlsOnInitialize: true,
        errorBuilder: (context, errorMessage) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error, color: Colors.red, size: 48),
                const SizedBox(height: 16),
                Text(
                  'Erro ao carregar o canal',
                  style: TextStyle(color: Colors.white),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _retryLoad,
                  child: const Text('Tentar novamente'),
                ),
              ],
            ),
          );
        },
      );

      setState(() => _isLoading = false);
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = e.toString();
      });
    }
  }

  void _retryLoad() {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    _initPlayer();
  }

  @override
  void dispose() {
    _videoController.dispose();
    _chewieController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black,
      child: Stack(
        children: [
          // Player
          if (_chewieController != null && !_isLoading)
            Chewie(controller: _chewieController!)
          else if (_isLoading)
            const Center(
              child: CircularProgressIndicator(color: Color(0xFF8B5CF6)),
            )
          else if (_error != null)
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error, color: Colors.red, size: 48),
                  const SizedBox(height: 16),
                  Text(_error!, style: const TextStyle(color: Colors.white)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _retryLoad,
                    child: const Text('Tentar novamente'),
                  ),
                ],
              ),
            ),

          // Header com nome do canal
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.7),
                    Colors.transparent,
                  ],
                ),
              ),
              child: Row(
                children: [
                  if (widget.onBack != null)
                    IconButton(
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                      onPressed: widget.onBack,
                    ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.channel.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Container(
                          margin: const EdgeInsets.only(top: 4),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.red,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'AO VIVO',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```

### Provider de Canais

```dart
// lib/providers/channels_provider.dart

import 'package:flutter/material.dart';
import '../models/channel.dart';
import '../services/api_service.dart';

class ChannelsProvider with ChangeNotifier {
  List<Channel> _channels = [];
  bool _isLoading = false;
  String? _error;

  List<Channel> get channels => _channels;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Map<String, List<Channel>> get channelsByCategory {
    final map = <String, List<Channel>>{};
    for (final channel in _channels) {
      final category = channel.category ?? 'Outros';
      map.putIfAbsent(category, () => []).add(channel);
    }
    return map;
  }

  Future<void> loadChannels() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _channels = await ApiService.fetchChannels();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Channel? getChannelById(String id) {
    try {
      return _channels.firstWhere((c) => c.id == id);
    } catch (_) {
      return null;
    }
  }
}
```

### Provider de Favoritos

```dart
// lib/providers/favorites_provider.dart

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FavoritesProvider with ChangeNotifier {
  static const _key = 'tv-favorites';
  List<String> _favorites = [];

  List<String> get favorites => _favorites;

  Future<void> loadFavorites() async {
    final prefs = await SharedPreferences.getInstance();
    _favorites = prefs.getStringList(_key) ?? [];
    notifyListeners();
  }

  Future<void> toggleFavorite(String channelId) async {
    if (_favorites.contains(channelId)) {
      _favorites.remove(channelId);
    } else {
      _favorites.add(channelId);
    }
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_key, _favorites);
    notifyListeners();
  }

  bool isFavorite(String channelId) {
    return _favorites.contains(channelId);
  }
}
```

---

## Backend Necessário

Para produção, você precisa de um backend:

### Estrutura da API

```
/api/channels          GET    Lista todos os canais
/api/channels/:id      GET    Detalhes de um canal
/api/epg/:channelId    GET    EPG de um canal
/api/epg/:id/current   GET    Programa atual
```

### Exemplo Node.js + Express

```javascript
// server.js

const express = require('express');
const cors = require('cors');
const { fetchEPGFromMeuGuia, parsePrograms } = require('./epgService');

const app = express();
app.use(cors());

// Canais (pode vir de banco de dados)
const channels = require('./data/channels.json');

// Cache de EPG
const epgCache = new Map();

app.get('/api/channels', (req, res) => {
  res.json(channels);
});

app.get('/api/epg/:channelId', async (req, res) => {
  const { channelId } = req.params;
  
  // Verifica cache
  if (epgCache.has(channelId)) {
    const cached = epgCache.get(channelId);
    if (Date.now() - cached.timestamp < 1800000) { // 30 min
      return res.json(cached.programs);
    }
  }
  
  try {
    const programs = await fetchEPGFromMeuGuia(channelId);
    epgCache.set(channelId, { programs, timestamp: Date.now() });
    res.json(programs);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar EPG' });
  }
});

app.get('/api/epg/:channelId/current', async (req, res) => {
  const { channelId } = req.params;
  
  let programs = epgCache.get(channelId)?.programs;
  if (!programs) {
    programs = await fetchEPGFromMeuGuia(channelId);
    epgCache.set(channelId, { programs, timestamp: Date.now() });
  }
  
  const now = new Date();
  const current = programs.find(p => 
    new Date(p.startTime) <= now && new Date(p.endTime) > now
  );
  const next = programs.find(p => new Date(p.startTime) > now);
  
  if (!current) {
    return res.json(null);
  }
  
  const total = new Date(current.endTime) - new Date(current.startTime);
  const elapsed = now - new Date(current.startTime);
  const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
  
  res.json({ current, next, progress });
});

app.listen(3000, () => {
  console.log('API rodando na porta 3000');
});
```

---

## Considerações Finais

### Performance

1. **Use cache agressivo** para EPG
2. **Lazy load** das imagens de logos
3. **Virtualize** listas longas
4. **Prefetch** do próximo canal

### UX

1. **Loading states** claros
2. **Tratamento de erros** amigável
3. **Offline support** básico
4. **Gestos** intuitivos (swipe, pinch)

### Monetização

1. Anúncios (AdMob)
2. Versão premium sem anúncios
3. Canais exclusivos premium

### Legal

1. Verifique direitos autorais
2. Use apenas streams legais
3. Implemente verificação de idade
