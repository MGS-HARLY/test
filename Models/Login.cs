using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace Template_MGS.Models
{
    public class Login
    {
        [Required]
        public string identifiant { get; set; }
        [Required]
        public string password { get; set; }
    }
}
