#!/usr/bin/env python3
"""
Knowledge Prompts Router v2.3
Purpose: Dynamic routing system for knowledge prompts
Version: 2.3 (Updated 2026-02-09)
Improvements from v2.2:
  - Added get_renovation_factor() function
  - Added get_geotechnical_factor() function
  - Support for dynamic renovation and geotechnical queries
"""

import yaml
import os
from typing import Dict, Any, Optional

class KnowledgePromptsRouter:
    """
    Dynamic router for knowledge prompts based on project parameters.
    Supports LAYER 1, LAYER 2, LAYER 3, and GC-specific knowledge.
    """
    
    def __init__(self, registry_path: str = "KNOWLEDGE_PROMPT_REGISTRY_v4.3.yaml"):
        """
        Initialize the router with the knowledge prompt registry.
        
        Args:
            registry_path: Path to the YAML registry file
        """
        self.registry_path = registry_path
        self.registry = self._load_registry()
    
    def _load_registry(self) -> Dict[str, Any]:
        """Load the knowledge prompt registry from YAML file."""
        try:
            with open(self.registry_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            print(f"Warning: Registry file not found at {self.registry_path}")
            return {}
    
    def get_knowledge_prompt(self, layer: str, **kwargs) -> Dict[str, Any]:
        """
        Main method to query knowledge prompts dynamically.
        
        Args:
            layer: Layer identifier (LAYER1, LAYER2, LAYER3, GC_SPECIFIC, RENOVATION_FACTORS, GEOTECHNICAL_FACTORS)
            **kwargs: Additional parameters (building_type, region, stage, gc_type, renovation_scope, etc.)
        
        Returns:
            Dictionary containing the knowledge prompt information
        """
        
        # Route to appropriate handler based on layer
        if layer == "LAYER1":
            return self._get_layer1(kwargs)
        elif layer == "LAYER2":
            return self._get_layer2(kwargs)
        elif layer == "LAYER3":
            return self._get_layer3(kwargs)
        elif layer == "GC_SPECIFIC":
            return self._get_gc_specific(kwargs)
        elif layer == "RENOVATION_FACTORS":
            return self.get_renovation_factor(kwargs)
        elif layer == "GEOTECHNICAL_FACTORS":
            return self.get_geotechnical_factor(kwargs)
        else:
            return {"error": f"Unknown layer: {layer}"}
    
    def _get_layer1(self, params: Dict) -> Dict[str, Any]:
        """Get LAYER 1 (Core Estimation Engine) knowledge prompt."""
        try:
            layer1 = self.registry.get("LAYER1", {})
            core_engine = layer1.get("CORE_ENGINE", [])
            if core_engine:
                return {
                    "name": core_engine[0].get("name"),
                    "version": core_engine[0].get("version"),
                    "file_path": core_engine[0].get("file_path"),
                    "status": core_engine[0].get("status"),
                    "description": core_engine[0].get("description")
                }
        except Exception as e:
            return {"error": f"Error retrieving LAYER1: {str(e)}"}
    
    def _get_layer2(self, params: Dict) -> Dict[str, Any]:
        """Get LAYER 2 (Domain-Specific Knowledge) prompts."""
        building_type = params.get("building_type", "warehouse").upper()
        prompt_type = params.get("prompt_type", "KNOWLEDGE")  # KNOWLEDGE, CASE_DATABASE, DECISION_MATRIX
        
        try:
            layer2 = self.registry.get("LAYER2", {})
            building_config = layer2.get(building_type, {})
            prompt_config = building_config.get(prompt_type, [])
            
            if prompt_config:
                return {
                    "name": prompt_config[0].get("name"),
                    "version": prompt_config[0].get("version"),
                    "file_path": prompt_config[0].get("file_path"),
                    "status": prompt_config[0].get("status"),
                    "type": prompt_config[0].get("type"),
                    "description": prompt_config[0].get("description")
                }
        except Exception as e:
            return {"error": f"Error retrieving LAYER2: {str(e)}"}
    
    def _get_layer3(self, params: Dict) -> Dict[str, Any]:
        """Get LAYER 3 (Optional Deep Verification Tools) prompts."""
        tool_type = params.get("tool_type", "CASE_FEATURE_EXTRACTION")
        
        try:
            layer3 = self.registry.get("LAYER3", {})
            tool_config = layer3.get(tool_type, [])
            
            if tool_config:
                return {
                    "name": tool_config[0].get("name"),
                    "version": tool_config[0].get("version"),
                    "file_path": tool_config[0].get("file_path"),
                    "status": tool_config[0].get("status"),
                    "type": tool_config[0].get("type"),
                    "description": tool_config[0].get("description")
                }
        except Exception as e:
            return {"error": f"Error retrieving LAYER3: {str(e)}"}
    
    def _get_gc_specific(self, params: Dict) -> Dict[str, Any]:
        """Get GC-specific knowledge prompts."""
        gc_type = params.get("gc_type", "UPRITE").upper()
        building_type = params.get("building_type", "WAREHOUSE").upper()
        
        try:
            gc_specific = self.registry.get("GC_SPECIFIC", {})
            gc_config = gc_specific.get(gc_type, [])
            
            if gc_config:
                return {
                    "name": gc_config[0].get("name"),
                    "version": gc_config[0].get("version"),
                    "file_path": gc_config[0].get("file_path"),
                    "status": gc_config[0].get("status"),
                    "gc_type": gc_config[0].get("gc_type"),
                    "building_type": gc_config[0].get("building_type"),
                    "description": gc_config[0].get("description")
                }
        except Exception as e:
            return {"error": f"Error retrieving GC_SPECIFIC: {str(e)}"}
    
    def get_renovation_factor(self, params: Dict) -> Dict[str, Any]:
        """
        Get renovation cost factor for a project.
        
        Args:
            params: Dictionary containing:
                - building_type: 'commercial_office', 'warehouse', 'healthcare'
                - renovation_scope: 'light', 'moderate', 'heavy'
                - region: 'CA_Inland', 'CA_Coastal', 'CA_Bay_Area', 'TX_Coastal', 'TX_Inland', 'NY_Urban', 'FL_Statewide'
                - stage: (optional) 'BIDDING', 'POST_AWARD', 'FINAL'
        
        Returns:
            Dictionary containing renovation factor information
        """
        building_type = params.get("building_type", "commercial_office").lower()
        renovation_scope = params.get("renovation_scope", "moderate").lower()
        region = params.get("region", "CA_Inland").upper()
        stage = params.get("stage", "BIDDING").upper()
        
        try:
            layer1 = self.registry.get("LAYER1", {})
            renovation_factors = layer1.get("RENOVATION_FACTORS", [])
            
            if renovation_factors:
                return {
                    "name": renovation_factors[0].get("name"),
                    "version": renovation_factors[0].get("version"),
                    "file_path": renovation_factors[0].get("file_path"),
                    "status": renovation_factors[0].get("status"),
                    "type": renovation_factors[0].get("type"),
                    "query_parameters": {
                        "building_type": building_type,
                        "renovation_scope": renovation_scope,
                        "region": region,
                        "stage": stage
                    },
                    "description": renovation_factors[0].get("description"),
                    "note": "Use RENOVATION_COST_FACTOR_MATRIX_v1.0.yaml to query specific factors"
                }
        except Exception as e:
            return {"error": f"Error retrieving renovation factor: {str(e)}"}
    
    def get_geotechnical_factor(self, params: Dict) -> Dict[str, Any]:
        """
        Get geotechnical cost factor for a project.
        
        Args:
            params: Dictionary containing:
                - region: 'CA_Inland', 'CA_Coastal', 'CA_Bay_Area', 'TX_Coastal', 'TX_Inland', 'NY_Urban', 'FL_Statewide'
                - building_type: 'commercial_office', 'warehouse', 'healthcare'
                - stage: 'BIDDING', 'POST_AWARD', 'FINAL'
        
        Returns:
            Dictionary containing geotechnical factor information
        """
        region = params.get("region", "CA_Inland").upper()
        building_type = params.get("building_type", "warehouse").lower()
        stage = params.get("stage", "BIDDING").upper()
        
        try:
            layer1 = self.registry.get("LAYER1", {})
            geotechnical_factors = layer1.get("GEOTECHNICAL_FACTORS", [])
            
            if geotechnical_factors:
                return {
                    "name": geotechnical_factors[0].get("name"),
                    "version": geotechnical_factors[0].get("version"),
                    "file_path": geotechnical_factors[0].get("file_path"),
                    "status": geotechnical_factors[0].get("status"),
                    "type": geotechnical_factors[0].get("type"),
                    "query_parameters": {
                        "region": region,
                        "building_type": building_type,
                        "stage": stage
                    },
                    "description": geotechnical_factors[0].get("description"),
                    "note": "Use GEOTECHNICAL_COST_DRIVER_MATRIX_v1.0.yaml to query specific factors"
                }
        except Exception as e:
            return {"error": f"Error retrieving geotechnical factor: {str(e)}"}
    
    def list_available_prompts(self, layer: str) -> Dict[str, Any]:
        """
        List all available prompts for a given layer.
        
        Args:
            layer: Layer identifier (LAYER1, LAYER2, LAYER3, GC_SPECIFIC)
        
        Returns:
            Dictionary containing available prompts
        """
        try:
            return self.registry.get(layer, {})
        except Exception as e:
            return {"error": f"Error listing prompts: {str(e)}"}


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    # Initialize the router
    router = KnowledgePromptsRouter()
    
    # Example 1: Get LAYER1 (Core Estimation Engine)
    print("=" * 80)
    print("Example 1: Get LAYER1 (Core Estimation Engine)")
    print("=" * 80)
    result = router.get_knowledge_prompt("LAYER1")
    print(f"Name: {result.get('name')}")
    print(f"Version: {result.get('version')}")
    print(f"Status: {result.get('status')}")
    print()
    
    # Example 2: Get LAYER2 Warehouse Knowledge
    print("=" * 80)
    print("Example 2: Get LAYER2 Warehouse Knowledge")
    print("=" * 80)
    result = router.get_knowledge_prompt("LAYER2", building_type="warehouse", prompt_type="DECISION_MATRIX")
    print(f"Name: {result.get('name')}")
    print(f"Version: {result.get('version')}")
    print(f"Type: {result.get('type')}")
    print()
    
    # Example 3: Get Renovation Factor
    print("=" * 80)
    print("Example 3: Get Renovation Factor")
    print("=" * 80)
    result = router.get_renovation_factor({
        "building_type": "commercial_office",
        "renovation_scope": "moderate",
        "region": "CA_Bay_Area",
        "stage": "BIDDING"
    })
    print(f"Name: {result.get('name')}")
    print(f"Version: {result.get('version')}")
    print(f"Query Parameters: {result.get('query_parameters')}")
    print()
    
    # Example 4: Get Geotechnical Factor
    print("=" * 80)
    print("Example 4: Get Geotechnical Factor")
    print("=" * 80)
    result = router.get_geotechnical_factor({
        "region": "CA_Inland",
        "building_type": "warehouse",
        "stage": "BIDDING"
    })
    print(f"Name: {result.get('name')}")
    print(f"Version: {result.get('version')}")
    print(f"Query Parameters: {result.get('query_parameters')}")
    print()
    
    # Example 5: Get GC-Specific Knowledge
    print("=" * 80)
    print("Example 5: Get GC-Specific Knowledge (UPRITE)")
    print("=" * 80)
    result = router.get_knowledge_prompt("GC_SPECIFIC", gc_type="UPRITE", building_type="warehouse")
    print(f"Name: {result.get('name')}")
    print(f"Version: {result.get('version')}")
    print(f"GC Type: {result.get('gc_type')}")
    print()
