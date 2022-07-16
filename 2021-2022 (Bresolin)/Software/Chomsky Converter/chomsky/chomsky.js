
var arrow = "->";
var epsilon = "ε";

function append_span(text, span) {
    var obj = document.createElement('span');
    obj.innerText = text;
    span.appendChild(obj);
}

function is_uppercase(str) { 
    return (str == str.toUpperCase() && str[0] <= 'Z' && str[0] >= 'A'); 
} 

function write_section(title_text, new_grammar, old_grammar) {
    let results_div = document.getElementById("results");

    let div = document.createElement('div');
    let title = document.createElement('h4');
    title.innerText = title_text;
    div.appendChild(title);
    
    for (let [variable, rules] of new_grammar) {
        let row = document.createElement('span');
        {
            let header = document.createElement('span');
            header.innerText = variable;
            
            // If the old grammar didn't have this, it's a new rule. Bold it
            if (!old_grammar.has(variable))
                row.className = "row-header";
            
            row.appendChild(header);
        }
        append_span(' → ', row)
        
        let first = true;
        for (let rule of rules) {
            let rule_span = document.createElement('span')
            let rule_text = rule;
            if (first) {
                first = false;
            } else {
                rule_text = ' | ' + rule;
            }
            
            rule_span.innerText = rule_text;
            // Check if this rule existed before
            if (old_grammar.get(variable) && !old_grammar.get(variable).has(rule))
                rule_span.className = "row-header";
            
            row.appendChild(rule_span);
        }
        
        row.appendChild(document.createElement('br'));
        div.appendChild(row);

    }

    results_div.appendChild(div);
}

function parse_input() {
    let input = document.getElementById("language-input").value;
    input = input.split("\n");

    let grammar = new Map();
    
    for (let i = 0; i < input.length; ++i) {
        if (input[i].length == 0)
            continue;

        // TODO: Check if this is split properly
        let row = input[i].split(arrow);

        // TODO: Verify this is an uppercase, single letter
        let variable = row[0].trim()[0];
        let rules = row[1].split('|');
        
        if (!grammar.has(variable)) {
            // Initialize to empty list
            grammar.set(variable, new Set());
        }

        for (let j = 0; j < rules.length; ++j) {
            // TODO: Verify that these rules are correct
            grammar.get(variable).add(rules[j].trim());
        }
        
    }

    return grammar;
}

function copy_grammar(grammar) {
    let new_grammar = new Map(grammar);

    for (let [key, val] of grammar) {
        new_grammar.set(key, new Set(val));
    }

    return new_grammar;
}

/* ----------- ACTUAL CHOMSKY RELATED CODE ----------- */

function get_next_free_variable(grammar) {
    let c = 'A'.charCodeAt(0);
    while (c <= 'Z'.charCodeAt(0) && grammar.has(String.fromCharCode(c)))
        ++c;

    return String.fromCharCode(c);
}

function step_one(grammar) {
    new_grammar = new Map();

    // Add new start symbol
    let new_start = new Set();
    // JavaScript maps preserve insertation order. Get start symbol (first variable)
    new_start.add(grammar.keys().next().value);
    new_grammar.set(get_next_free_variable(grammar), new_start);

    new_grammar = new Map([...new_grammar, ...grammar]);

    
    write_section("Primo passo: Aggiungo un nuovo simbolo di partenza", new_grammar, grammar);
    return new_grammar;
}

function step_two(grammar) {
    function has_epsilon_rule(grammar) {
        let first = true;

        // Find an epsilon rule
        for (let [variable, rules] of grammar) {
            if (first) {
                // The start rule (the 1st) is allowed to have epsilon
                first = false;
                continue;
            }
            for (let rule of rules) {
                if (rule == epsilon) {
                    return true;
                }
            }
        }
        return false;
    }

    function remove_epsilon_rule(var_to_remove, grammar) {
        function add_permutations(var_to_remove, rule, perms) {
            for (let i = 0; i < rule.length; ++i) {
                if (rule[i] == var_to_remove) {
                    let rule2 = rule.substring(0, i) + rule.substring(i + 1, rule.length)
                    perms.add(rule2);
                    add_permutations(var_to_remove, rule2, perms);
                }
            }
        }
        let new_grammar = new Map(grammar);
        
        for (let [variable, rules] of grammar) {
            for (let rule of rules) {
                if (rule.includes(var_to_remove)) {
                    let perms = new Set();
                    add_permutations(var_to_remove, rule, perms);

                    for (let rule2 of perms) {
                        if (rule2.length == 0)
                            rule2 = epsilon;
                        rules.add(rule2);
                    }

                }
            }
        }

        new_grammar.get(var_to_remove).delete(epsilon);

        return new_grammar;
    }

    new_grammar = copy_grammar(grammar);

    while (has_epsilon_rule(new_grammar)) {
        for (let [variable, rules] of new_grammar) {
            for (let rule of rules) {
                if (rule == epsilon) {
                    new_grammar = remove_epsilon_rule(variable, new_grammar);
                }
            }
        }
    }

    write_section("Passo 2: Rimuovo le ε regole", new_grammar, grammar);
    return new_grammar;
}

function step_three(grammar) {
    new_grammar = copy_grammar(grammar);

    for (let [variable, rules] of new_grammar) {
        for (let rule of rules) {
            if (rule == epsilon) {
                continue;
            }
            
            if (rule == variable) {
                rules.delete(rule);
                continue;
            }

            if (rule.length != 1 || !is_uppercase(rule)) 
                continue;
            
            let new_rules = new_grammar.get(rule);
            for (let new_rule of new_rules)
                rules.add(new_rule);

            rules.delete(rule);
        }
    }


    write_section("Passo 3: Rimuovo le regole unitarie", new_grammar, grammar);
    return new_grammar;
}

function add_or_reuse(rule, grammar) {
    let match = false;
    for (let [variable, rules] of grammar) 
        if (rules.size == 1 && rules.has(rule))
            match =  variable;

    if (match) {
        return match;
    } else {
        // Need to make a new one
        let new_variable = get_next_free_variable(grammar);
        grammar.set(new_variable, new Set([rule]));
        return new_variable;
    }
}

function step_four(grammar) {
    function trim(rule, grammar) {
        if (rule.length != 2) {
            let new_var = trim(rule.slice(1, rule.length), grammar);
            return add_or_reuse(rule.slice(0, 1) + new_var, grammar);
        } else {
            return add_or_reuse(rule, grammar);
        }
    }

    let new_grammar = copy_grammar(grammar);

    for (let [variable, rules] of new_grammar) {
        for (let rule of rules) {
            if (rule.length > 2) {
                rules.add(rule.slice(0,1) + trim(rule.slice(1, rule.length), new_grammar));
                rules.delete(rule);
            }
        }
    }

    write_section("Passo 4: Divido le regole in parti", new_grammar, grammar);

    return new_grammar;
}

function step_five(grammar) {
    let new_grammar = copy_grammar(grammar);

    for (let [variable, rules] of new_grammar) {
        let next_value = rules.values().next().value;
        if (rules.size == 1 && next_value.length == 1 && !is_uppercase(next_value))
            // skip F -> s
            continue;
        
        for (let rule of rules) {
            if (rule == epsilon)
                continue;

            let new_rule = "";
            for (let symbol of rule) {

                if (!is_uppercase(symbol)) {
                    new_rule += add_or_reuse(symbol, new_grammar);
                } else {
                    new_rule += symbol;
                }
            }

            if (new_rule != rule) {
                rules.add(new_rule);
                rules.delete(rule);
            }
        }
    }

    write_section("Passo 5: Sotituisco i terminali con le variabili", new_grammar, grammar);

    return new_grammar;

}

function clear_results() {
    results_div = document.getElementById("results");
    var cNode = results_div.cloneNode(false);
    results_div.parentNode.replaceChild(cNode, results_div);
}

function do_chomsky() {
    clear_results();
    grammar = parse_input();
    grammar = step_one(grammar);
    grammar = step_two(grammar);
    grammar = step_three(grammar);
    grammar = step_four(grammar);
    grammar = step_five(grammar);

}


document.getElementById("calculate-button").addEventListener("click", do_chomsky)
