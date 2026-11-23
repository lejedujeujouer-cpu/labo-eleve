// Labo Élève — verrou du clavier pendant le mode focus et le mode examen.
// Bloque les raccourcis qui permettent de quitter l'application ou de changer de bureau Windows :
//   touche Windows (et donc Win+Tab, Win+Ctrl+D, Win+Ctrl+← →, Win+D, Win+R…), Alt+Tab, Alt+Échap,
//   Ctrl+Échap (menu Démarrer) et Ctrl+Maj+Échap (Gestionnaire des tâches).
// Ctrl+Alt+Suppr ne peut pas être bloqué (protection de Windows).
//
// Logiciel de TP autorisé (ex. Redy de Jeulin, en mode focus seulement) :
//   - le module indique à Labo Élève quel programme est au premier plan (« pp <pid>|<chemin> ») et si une fenêtre
//     du logiciel autorisé est ouverte (« ouvert 1 » / « ouvert 0 ») ;
//   - quand le logiciel autorisé est au premier plan, un petit bouton « Revenir à Labo Élève » s'affiche en bas à droite.
// Commandes reçues (une par ligne) : « labo <hwnd> », « autorise <dossier1>|<dossier2> », « montrer » (logiciel autorisé
// devant), « revenir » (Labo Élève devant : retour forcé).
//
// Le programme s'arrête tout seul dès que Labo Élève est fermé (numéro du processus parent en argument).
// Compilation : csc.exe /nologo /target:winexe /out:verrou-clavier.exe verrou-clavier.cs
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

static class VerrouClavier
{
    const int WH_KEYBOARD_LL = 13;
    const int LLKHF_ALTDOWN = 0x20;
    const int VK_TAB = 0x09, VK_CONTROL = 0x11, VK_MENU = 0x12, VK_ESCAPE = 0x1B, VK_LWIN = 0x5B, VK_RWIN = 0x5C;

    delegate IntPtr Crochet(int code, IntPtr wParam, IntPtr lParam);
    delegate bool RappelFenetre(IntPtr hwnd, IntPtr param);

    [StructLayout(LayoutKind.Sequential)]
    struct Touche { public int vk; public int scan; public int flags; public int time; public IntPtr extra; }

    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, Crochet fn, IntPtr module, uint thread);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string nom);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int cmd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd, uint cmd);
    [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr hwnd);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern bool EnumWindows(RappelFenetre fn, IntPtr param);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint acces, bool heriter, uint pid);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder nom, ref int taille);

    static readonly Crochet fonction = Filtrer; // gardé en mémoire (sinon le ramasse-miettes le supprime)
    static IntPtr crochet = IntPtr.Zero;
    static int[] supplementaires = new int[0]; // touches en plus (utilisé pour les tests)

    static IntPtr laboFenetre = IntPtr.Zero;
    static List<string> dossiersAutorises = new List<string>();
    static readonly object verrou = new object();
    static Form bouton;
    static uint dernierPid = 0;
    static IntPtr derniereFenetre = IntPtr.Zero;
    static int dernierOuvert = -1;
    static readonly uint monPid = (uint)Process.GetCurrentProcess().Id;

    static void Ecrire(string ligne) { try { Console.WriteLine(ligne); Console.Out.Flush(); } catch { } }

    static IntPtr Filtrer(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0)
        {
            Touche t = (Touche)Marshal.PtrToStructure(lParam, typeof(Touche));
            bool alt = (t.flags & LLKHF_ALTDOWN) != 0;
            bool ctrl = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0;
            bool bloquer =
                t.vk == VK_LWIN || t.vk == VK_RWIN ||
                (alt && (t.vk == VK_TAB || t.vk == VK_ESCAPE)) ||
                (ctrl && t.vk == VK_ESCAPE) ||
                Array.IndexOf(supplementaires, t.vk) >= 0;
            if (bloquer) { Ecrire("bloque " + t.vk); return (IntPtr)1; }
        }
        return CallNextHookEx(crochet, code, wParam, lParam);
    }

    static string CheminProcessus(uint pid)
    {
        IntPtr h = OpenProcess(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, false, pid);
        if (h == IntPtr.Zero) return "";
        try
        {
            StringBuilder sb = new StringBuilder(1024);
            int taille = sb.Capacity;
            return QueryFullProcessImageName(h, 0, sb, ref taille) ? sb.ToString() : "";
        }
        finally { CloseHandle(h); }
    }

    static bool Autorise(string chemin)
    {
        if (string.IsNullOrEmpty(chemin)) return false;
        lock (verrou)
        {
            foreach (string d in dossiersAutorises)
                if (chemin.StartsWith(d.TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    // Fenêtre principale (visible, avec un titre, sans propriétaire) du logiciel autorisé.
    static IntPtr FenetreAutorisee()
    {
        IntPtr trouvee = IntPtr.Zero;
        Dictionary<uint, bool> cache = new Dictionary<uint, bool>();
        EnumWindows(delegate (IntPtr hwnd, IntPtr p)
        {
            if (!IsWindowVisible(hwnd) || GetWindowTextLength(hwnd) == 0 || GetWindow(hwnd, 4 /* GW_OWNER */) != IntPtr.Zero) return true;
            uint pid; GetWindowThreadProcessId(hwnd, out pid);
            if (pid == monPid) return true;
            bool ok;
            if (!cache.TryGetValue(pid, out ok)) { ok = Autorise(CheminProcessus(pid)); cache[pid] = ok; }
            if (ok) { trouvee = hwnd; return false; }
            return true;
        }, IntPtr.Zero);
        return trouvee;
    }

    // Windows n'autorise un programme à passer devant que s'il vient d'agir : une pression de la touche Alt suffit.
    static void MettreDevant(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero) return;
        if (IsIconic(hwnd)) ShowWindow(hwnd, 9 /* SW_RESTORE */);
        keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
        keybd_event(VK_MENU, 0, 2 /* KEYEVENTF_KEYUP */, UIntPtr.Zero);
        SetForegroundWindow(hwnd);
    }

    static void Surveiller()
    {
        IntPtr fg = GetForegroundWindow();
        uint pid; GetWindowThreadProcessId(fg, out pid);
        if (fg != derniereFenetre || pid != dernierPid)
        {
            derniereFenetre = fg;
            if (pid != dernierPid)
            {
                dernierPid = pid;
                if (pid != monPid) Ecrire("pp " + pid + "|" + CheminProcessus(pid));
            }
        }
        // Bouton « Revenir à Labo Élève » : visible quand le logiciel autorisé est devant (ou quand on clique dessus).
        if (pid != monPid)
        {
            bool montrer = laboFenetre != IntPtr.Zero && dossiersAutorises.Count > 0 && Autorise(CheminProcessus(pid));
            if (montrer && !bouton.Visible) { PlacerBouton(); bouton.Show(); }
            else if (!montrer && bouton.Visible) bouton.Hide();
        }
    }

    static void SurveillerOuverture()
    {
        if (dossiersAutorises.Count == 0) { if (dernierOuvert != 0) { dernierOuvert = 0; } return; }
        int ouvert = FenetreAutorisee() != IntPtr.Zero ? 1 : 0;
        if (ouvert != dernierOuvert) { dernierOuvert = ouvert; Ecrire("ouvert " + ouvert); }
    }

    static void PlacerBouton()
    {
        Rectangle zone = Screen.PrimaryScreen.WorkingArea;
        bouton.Location = new Point(zone.Right - bouton.Width - 16, zone.Bottom - bouton.Height - 16);
    }

    static void Commande(string ligne)
    {
        if (ligne == null) return;
        ligne = ligne.Trim();
        if (ligne.StartsWith("labo "))
        {
            long h; if (long.TryParse(ligne.Substring(5), out h)) laboFenetre = new IntPtr(h);
        }
        else if (ligne.StartsWith("autorise"))
        {
            List<string> l = new List<string>();
            foreach (string d in ligne.Substring(8).Trim().Split('|')) if (d.Trim().Length > 0) l.Add(d.Trim());
            lock (verrou) { dossiersAutorises = l; }
            dernierOuvert = -1;
            if (l.Count == 0 && bouton.Visible) bouton.Hide();
        }
        else if (ligne == "revenir")
        {
            // Retour forcé : Labo Élève repasse devant (un autre programme a pris la main).
            if (bouton.Visible) bouton.Hide();
            MettreDevant(laboFenetre);
        }
        else if (ligne == "montrer")
        {
            IntPtr h = FenetreAutorisee();
            Ecrire(h != IntPtr.Zero ? "montre 1" : "montre 0");
            MettreDevant(h);
        }
    }

    [STAThread]
    static void Main(string[] arguments)
    {
        int parent = 0;
        if (arguments.Length > 0) int.TryParse(arguments[0], out parent);
        if (arguments.Length > 1)
        {
            string[] morceaux = arguments[1].Split(',');
            supplementaires = new int[morceaux.Length];
            for (int i = 0; i < morceaux.Length; i++) int.TryParse(morceaux[i], out supplementaires[i]);
        }
        crochet = SetWindowsHookEx(WH_KEYBOARD_LL, fonction, GetModuleHandle(null), 0);
        if (crochet == IntPtr.Zero) { Ecrire("echec"); return; }

        // Petit bouton flottant pour revenir à Labo Élève depuis le logiciel de TP.
        bouton = new Form();
        bouton.FormBorderStyle = FormBorderStyle.None;
        bouton.ShowInTaskbar = false;
        bouton.TopMost = true;
        bouton.StartPosition = FormStartPosition.Manual;
        bouton.Size = new Size(250, 52);
        bouton.BackColor = Color.FromArgb(88, 101, 242);
        Button b = new Button();
        b.Dock = DockStyle.Fill;
        b.FlatStyle = FlatStyle.Flat;
        b.FlatAppearance.BorderSize = 0;
        b.ForeColor = Color.White;
        b.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
        b.Text = "↩  Revenir à Labo Élève";
        b.Cursor = Cursors.Hand;
        b.Click += delegate { bouton.Hide(); MettreDevant(laboFenetre); Ecrire("retour"); };
        bouton.Controls.Add(b);
        IntPtr creer = bouton.Handle; // crée la fenêtre sur ce fil (les commandes y sont renvoyées)

        // Commandes de Labo Élève (entrée standard), traitées sur le fil de l'interface.
        Thread lecteur = new Thread(delegate ()
        {
            try
            {
                string l;
                while ((l = Console.In.ReadLine()) != null) { string copie = l; try { bouton.BeginInvoke((MethodInvoker)delegate { Commande(copie); }); } catch { } }
            }
            catch { }
        });
        lecteur.IsBackground = true;
        lecteur.Start();
        Ecrire("pret");

        System.Windows.Forms.Timer premierPlan = new System.Windows.Forms.Timer();
        premierPlan.Interval = 250;
        premierPlan.Tick += delegate { Surveiller(); };
        premierPlan.Start();
        System.Windows.Forms.Timer ouverture = new System.Windows.Forms.Timer();
        ouverture.Interval = 1000;
        ouverture.Tick += delegate { SurveillerOuverture(); };
        ouverture.Start();

        // Labo Élève fermé (ou planté) : on s'arrête, le clavier redevient normal.
        System.Windows.Forms.Timer surveillance = new System.Windows.Forms.Timer();
        surveillance.Interval = 1000;
        surveillance.Tick += delegate
        {
            if (parent <= 0) return;
            try { Process p = Process.GetProcessById(parent); if (p.HasExited) Application.Exit(); }
            catch { Application.Exit(); }
        };
        surveillance.Start();
        Application.Run();
        UnhookWindowsHookEx(crochet);
    }
}
