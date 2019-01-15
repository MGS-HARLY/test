using System;
using System.Collections;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Template_MGS.Models;

namespace Template_MGS.Controllers
{
    public class HomeController : Controller
    {
        public ActionResult Login()
        {
            return View();
        }

        [HttpPost]
        public ActionResult Login(Login L)
        {
            if (!ModelState.IsValid)
            {
                return View(L);
            }

            HttpContext.Session.Clear();

            if (string.IsNullOrEmpty(HttpContext.Session.GetString("_Utilisateur")))
            {
                HttpContext.Session.SetString("_Utilisateur", L.identifiant);
            }
            log_navigator("", "", "", HttpContext);
            return RedirectToAction("Index", "Home");
        }

        public IActionResult Index()
        {
            var utilisateur = HttpContext.Session.GetString("_Utilisateur");
            if (utilisateur != null)
            {
                return View();
            }

            return RedirectToAction("Login", "Home");
        }


        protected void log_navigator(string user, string fonction, string page, HttpContext Hcon)
        {
            string host = Hcon.Request.Host.Host;
            string conSTR = "";
            if (host.Contains("localhost"))
            {
                conSTR = @"Server=tcp:MGS29-JONATHAN\MGS_LOCAL,1434;Initial Catalog=DB_MGS_DASHBOARDS_LOGS; User ID=Sebastien; Password=Traitement!05";
            }
            else
            {
                Thread.CurrentThread.CurrentCulture = CultureInfo.GetCultureInfo("en-US");
                conSTR = @"Server=S17608992\MSSQLSERVER_LIVE;Initial Catalog=DB_MGS_DASHBOARDS_LOGS; User ID=Sebastien; Password=Traitement!05";
            }

            using (var sqlConnection1 = new SqlConnection(conSTR))
            {
                var utilisateur = HttpContext.Session.GetString("_Utilisateur");
                String userAgent = Hcon.Request.Headers["User-Agent"];

                String browser = "";
                String browserVersion = "";

                var ipAddress = Hcon.Connection.RemoteIpAddress?.ToString();
                if (userAgent.IndexOf("Safari") > 0) { browser = "Safari"; browserVersion = userAgent.Substring(userAgent.IndexOf("Safari") + ("Safari").Length + 1, 4); ; }
                if (userAgent.IndexOf("Chrome") > 0) { browser = "Chrome"; browserVersion = userAgent.Substring(userAgent.IndexOf("Chrome") + ("Chrome").Length+1,4); }
                if (userAgent.IndexOf("Edge") > 0) { browser = "Edge"; browserVersion = userAgent.Substring(userAgent.IndexOf("Edge") + ("Edge").Length + 1, 4); ; }
                if (userAgent.IndexOf("Firefox") > 0) { browser = "Firefox"; browserVersion = userAgent.Substring(userAgent.IndexOf("Firefox") + ("Firefox").Length + 1, 4); ; }
                if (userAgent.IndexOf("OPR") > 0) { browser = "Opera"; browserVersion = userAgent.Substring(userAgent.IndexOf("OPR") + ("OPR").Length + 1, 4); ; }
                if (browser.Length < 1) { browser = "IE"; browserVersion = ""; }

                int indexParentheseO = Hcon.Request.Headers["User-Agent"].ToString().IndexOf("(") + 1;
                int indexParentheseF = Hcon.Request.Headers["User-Agent"].ToString().IndexOf(")");
                String OS = Hcon.Request.Headers["User-Agent"].ToString().Substring(indexParentheseO, (indexParentheseF - indexParentheseO));

                if (!host.Contains("localhost") && (utilisateur.ToLower() != "superadmin" || utilisateur.ToLower() != "dev"))
                {
                    var cmd = new SqlCommand();
                    cmd.Connection = sqlConnection1;

                    cmd.CommandText = "SELECT Id FROM DASHBOARD WHERE Nom = 'Prime';";
                    int dashboardId = (int)cmd.ExecuteScalar();

                    cmd.CommandText = "INSERT INTO LOG (IdDashboard, DateEnregistrement, Info_1, Info_2, Info_3,Info_4,Info_5) " +
                        "VALUES (" + dashboardId + ", @date_enr, @info1, @info2,@info3,@info4,@info5);";

                    cmd.Parameters.AddWithValue("@date_enr", DateTime.Now);
                    cmd.Parameters.AddWithValue("@info1", OS);
                    cmd.Parameters.AddWithValue("@info2", browser + "/" + browserVersion);
                    cmd.Parameters.AddWithValue("@info3", user);
                    cmd.Parameters.AddWithValue("@info4", "Connexion IPSOS");
                    cmd.Parameters.AddWithValue("@info5", page);
                    cmd.ExecuteNonQuery();
                    sqlConnection1.Close();
                }
            }
        }

    }
}
