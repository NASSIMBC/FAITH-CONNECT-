import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'feed_page.dart'; // Assure-toi que ce fichier existe bien dans le dossier lib

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialisation de Supabase avec tes vraies clés
  await Supabase.initialize(
    url: 'https://uduajuxobmywmkjnawjn.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdWFqdXhvYm15d21ram5hd2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NjUyMTUsImV4cCI6MjA4MzA0MTIxNX0.Vn1DpT9l9N7sVb3kVUPRqr141hGvM74vkZULJe59YUU',
  );

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Faith Connect',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        // Couleur violette pour le thème
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      // On démarre sur le fil d'actualité
      home: const FeedPage(),
    );
  }
}