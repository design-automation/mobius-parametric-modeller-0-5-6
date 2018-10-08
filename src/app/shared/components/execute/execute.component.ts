import { Component, Input } from '@angular/core';
import { IFlowchart } from '@models/flowchart';
import { CodeUtils } from '@models/code';
import { INode } from '@models/node';
import { IProcedure } from '@models/procedure';
import { IEdge } from '@models/edge';

import * as Modules from '@modules';


@Component({
  selector: 'execute',
  template: `<button class="btn--execute" 
                    (click)="execute($event)">
                Execute
             </button>`,
  styles: [ 
            `.btn--execute{ 
                font-size: 14px;
                line-height: 18px;
                border: 3px solid #E0C229;
                border-radius: 4px;
                padding: 2px 10px;
                background-color: #E0C229; 
                color: #494D59;
                font-weight: 600;
                text-transform: uppercase;
              }` 
          ]
})
export class ExecuteComponent {

    @Input() flowchart: IFlowchart;
    execute($event): void {
        let executed = [];
        let count = 0;
		while(executed.length < this.flowchart.nodes.length || count > 100){

            // TODO: Remove after debugging
            count = count + 1;

            for(let index=0; index < this.flowchart.nodes.length; index++){

				let node = this.flowchart.nodes[index];
				if(executed.indexOf(index) > -1){
					// node has already executed - do nothing
				}
				else{

					// check if all inputs have valid inputs
					// if yes, execute add to executed
					// if no, set flag to true 
					// check status of the node; don't rerun
					if( !node.enabled ){ // or hasFnOutput  
						// do nothing
						executed.push(index);
					}
					else{

						let flag = true;
						for(let i=0; i < node.inputs.length; i++){
							let inp = node.inputs[i];

                            // if input has a value and the value has a port property
                            // port property means the port is connected to another port - 
                            // and is waiting for previous node to execute
							if(inp.value && inp.value["port"]){
                                flag = false;
								break;
							}
						}

                        // if there is a missing input, the flag is false
						if(flag){
                            console.log(`${node.name} executing...`);
                            this.executeNode(node);
							executed.push(index);
                        }
                        else{
                            console.log(`${node.name} waiting for inputs...`);
                        }

					}
				}
			} 
		}
    }
    */

    async executeNode(node: INode){
        let prodArr: string[] = [''];
        try{
            //new Function ([arg1[, arg2[, ...argN]],] functionBody)
            var fnString = await CodeUtils.getNodeCode(node, true);
            const fn = new Function('__MODULES__', '__PRODARR__', fnString);
            let results = fn(Modules, prodArr);
            node.outputs.map( (oup) => {
                if (typeof results[oup.name] === 'number' || results[oup.name] === undefined){
                    oup.value = results[oup.name];
                } else if (typeof results[oup.name] === 'string'){
                    oup.value = '"' + results[oup.name] + '"';
                } else if (results[oup.name].constructor === [].constructor){
                    oup.value = '[' + results[oup.name] + ']';
                } else if (results[oup.name].constructor === {}.constructor) {
                    oup.value = JSON.stringify(results[oup.name]);
                } else {
                    oup.value = results[oup.name];
                }

                // iterate through all edges
                // for every edge with source as this output-port
                // update the connected input-port
                for(let e=0; e < this.flowchart.edges.length; e++){
                    let edge: IEdge = this.flowchart.edges[e];

                    if( edge.source.id == oup.id ){
                        edge.target.value = oup.value; 
                        console.log('Assigned value');
                    }
                }
            });

            
        }
        catch(ex){
            node.hasError = true;
            //console.warn(`${node.name} errored`);

            // Unexpected Identifier
            // Unexpected token
            let prodWithError: string = prodArr[0]; 
            let markError = function(prod: IProcedure, id: string){
                if(prod["ID"] && id && prod["ID"] == id){
                    prod.hasError = true;
                }
                if(prod.hasOwnProperty('children')){
                    prod.children.map(function(p){
                        markError(p, id);
                    });
                }
            }
            if(prodWithError != ''){
                node.procedure.map(function(prod: IProcedure){
                    if(prod["ID"] == prodWithError){
                        prod.hasError = true;
                    }
                    if(prod.hasOwnProperty('children')){
                        prod.children.map(function(p){
                            markError(p, prodWithError);
                        })
                    }
                });
            }
            let error: Error;
            if(ex.toString().indexOf("Unexpected identifier") > -1){
                error = new Error("Unexpected Identifier error. Did you declare everything? Check that your strings are enclosed in quotes (\")");
            }
            else if(ex.toString().indexOf("Unexpected token") > -1){
                error = new Error("Unexpected token error. Check for stray spaces or reserved keywords?");
            }
            else{
                 error = new Error(ex);
            }
            throw error;
            
        }
    }

}
